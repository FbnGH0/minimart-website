/*
  admin.js = BEHAVIOUR of the admin screen.

  Parts:
    1. Helpers (messages, busy buttons, photo upload/delete)
    2. Login / logout, and switching between login and dashboard
    3. Tabs
    4. Site settings forms (all the text, links, map and hero photo)
    5. Categories + products: load and draw the boxes
    6. Categories: add, rename, move, delete
    7. Product pop-up: add / edit
    8. Products: delete

  Most database calls look like this:
    const { data, error } = await db.from("table").something();
  "await" waits for Supabase's reply. If something went wrong, "error" is
  filled in; otherwise "data" holds the result.

  Anything typed by a person is put on the page with textContent, never
  innerHTML, so text like "<script>" shows as plain text and can't run.
*/


// ===== 1. Helpers =====

// Shows a message under a form. isError = true makes it red.
function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("is-error", isError);
}

// Greys out a button while something saves (so it can't be clicked
// twice) and swaps its text, e.g. to "Saving…".
function setBusy(button, isBusy, busyText = "Saving…") {
  if (isBusy) {
    button.dataset.label = button.innerHTML;   // remember the normal look
    button.textContent = busyText;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;   // our own markup, safe to restore
  }
  button.disabled = isBusy;
}

// A change that came back with no rows means the security rules blocked it
function blockedError() {
  return new Error("not allowed. Try logging out and in again.");
}

const MAX_PHOTO_MB = 5;

function checkPhotoSize(file) {
  if (file && file.size > MAX_PHOTO_MB * 1024 * 1024) {
    throw new Error(`that photo is too big. Please use one under ${MAX_PHOTO_MB} MB.`);
  }
}

// Uploads a photo into a folder ("products" or "hero") and returns its
// public link + file name. Throws an error if the upload fails.
async function uploadPhoto(file, folder) {
  checkPhotoSize(file);
  // Unique name, e.g. "products/1760693000000-k3j9x2.jpg", so two photos
  // called "photo.jpg" never overwrite each other
  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = db.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Deletes a photo from storage. If this fails, nothing breaks; the old
// file just stays in storage, so we don't stop for it.
async function removePhoto(path) {
  if (path) await db.storage.from(IMAGE_BUCKET).remove([path]);
}


// ===== 2. Login / logout =====
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const logoutBtn = document.getElementById("logout-btn");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

// Which user's data is on screen, so we don't reload it for no reason
let loadedForUser = null;

// Shows the login form OR the dashboard ("session" is null when
// nobody is logged in).
function showView(session) {
  const loggedIn = Boolean(session);
  loginView.hidden = loggedIn;
  dashboardView.hidden = !loggedIn;
  logoutBtn.hidden = !loggedIn;

  if (loggedIn && loadedForUser !== session.user.id) {
    loadedForUser = session.user.id;
    fillSettingsForms();
    loadCatalog();
  }
  if (!loggedIn) loadedForUser = null;
}

// Supabase calls this when the page opens (with any saved login) and
// whenever someone logs in or out. The login is remembered in the
// browser, so the owner doesn't have to log in every visit.
// setTimeout(..., 0) runs showView just after Supabase finishes its own
// work, which avoids a known freeze when calling Supabase from in here.
db.auth.onAuthStateChange((_event, session) => {
  setTimeout(() => showView(session), 0);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();   // stop the browser reloading the page
  const button = loginForm.querySelector("button");
  setBusy(button, true, "Logging in…");
  setMessage(loginMessage, "");

  const { error } = await db.auth.signInWithPassword({
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value,
  });

  setBusy(button, false);
  if (error) {
    setMessage(loginMessage, "Wrong email or password.", true);
  } else {
    loginForm.reset();   // onAuthStateChange shows the dashboard
  }
});

logoutBtn.addEventListener("click", () => db.auth.signOut());


// ===== 3. Tabs =====
const tabs = document.querySelectorAll(".admin-tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((other) => {
      const isThis = other === tab;
      other.classList.toggle("is-active", isThis);
      other.setAttribute("aria-selected", isThis);
      document.getElementById(other.dataset.panel).hidden = !isThis;
    });
  });
});


// ===== 4. Site settings forms =====
/*
  Every <form class="settings-form"> saves to the one row in site_settings.
  Each input's name="" matches a column, so one piece of code handles
  every form: it saves only the inputs inside the form you clicked Save on.
*/
const settingsForms = document.querySelectorAll(".settings-form");
const heroForm = document.getElementById("hero-form");
const heroPreview = document.getElementById("hero-preview");
const heroImage = document.getElementById("hero-image");
const heroResetBtn = document.getElementById("hero-reset-btn");
const mapLocation = document.getElementById("map-location");
const mapPreview = document.getElementById("map-preview");

let settings = {};   // the last values loaded from / saved to the database

async function fillSettingsForms() {
  const data = await loadSettings();   // from site-common.js
  if (!data) {
    settingsForms.forEach((form) =>
      setMessage(form.querySelector(".form-message"), "Couldn't load the saved details.", true));
    return;
  }
  settings = data;

  // Put each saved value into the input with the matching name
  settingsForms.forEach((form) => {
    form.querySelectorAll("[name]").forEach((input) => {
      input.value = data[input.name] ?? "";   // ?? "" turns null into an empty box
    });
  });

  showHeroPreview();
  updateMapPreview();
}

function showHeroPreview() {
  heroPreview.src = settings.hero_image_url || "images/hero.jpg";
  heroResetBtn.hidden = !settings.hero_image_url;   // only offer reset if changed
}

// Map preview follows what's typed, after a short pause
let mapTimer;
function updateMapPreview() {
  mapPreview.src = mapEmbedUrl(mapLocation.value) || "about:blank";
}
mapLocation.addEventListener("input", () => {
  clearTimeout(mapTimer);
  mapTimer = setTimeout(updateMapPreview, 600);   // wait until typing stops
});

// Show a picked hero photo straight away (it saves when you press Save)
heroImage.addEventListener("change", () => {
  const file = heroImage.files[0];
  if (file) heroPreview.src = URL.createObjectURL(file);
});

// Saves some columns of site_settings and returns the updated row
async function saveSettings(changes) {
  changes.updated_at = new Date().toISOString();
  // .select() sends back the changed rows; an empty list means the
  // security rules blocked the update
  const { data, error } = await db
    .from("site_settings")
    .update(changes)
    .eq("id", 1)
    .select();
  if (error) throw error;
  if (data.length === 0) throw blockedError();
  settings = data[0];
  return settings;
}

settingsForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector(".form-message");
    setBusy(button, true);
    setMessage(message, "");

    try {
      // Collect { column: value } from this form's named inputs
      const changes = {};
      form.querySelectorAll("[name]").forEach((input) => {
        changes[input.name] = input.value.trim();
      });

      // The hero form can also carry a new photo
      let oldPhotoPath = null;
      if (form === heroForm && heroImage.files[0]) {
        const photo = await uploadPhoto(heroImage.files[0], "hero");
        changes.hero_image_url = photo.url;
        changes.hero_image_path = photo.path;
        oldPhotoPath = settings.hero_image_path;
      }

      await saveSettings(changes);
      await removePhoto(oldPhotoPath);   // tidy up the replaced photo
      if (form === heroForm) {
        heroImage.value = "";
        showHeroPreview();
      }
      setMessage(message, "Saved! Refresh the site to see it.");
    } catch (error) {
      setMessage(message, "Couldn't save: " + error.message, true);
    } finally {
      setBusy(button, false);   // "finally" always runs, error or not
    }
  });
});

heroResetBtn.addEventListener("click", async () => {
  if (!confirm("Go back to the original background photo?")) return;
  const message = heroForm.querySelector(".form-message");
  try {
    const oldPath = settings.hero_image_path;
    await saveSettings({ hero_image_url: null, hero_image_path: null });
    await removePhoto(oldPath);
    heroImage.value = "";
    showHeroPreview();
    setMessage(message, "Back to the original photo.");
  } catch (error) {
    setMessage(message, "Couldn't change it: " + error.message, true);
  }
});


// ===== 5. Categories + products: load and draw =====
const categoryList = document.getElementById("category-list");
const catalogMessage = document.getElementById("catalog-message");

// Copies of what's in the database, so buttons can find details
// (like a product's old photo) without asking Supabase again
let categories = [];
let products = [];

async function loadCatalog() {
  // Ask for both at the same time; Promise.all waits for both replies
  const [categoryResult, productResult] = await Promise.all([
    db.from("categories").select("*").order("sort_order").order("id"),
    db.from("products").select("*").order("created_at"),
  ]);

  const error = categoryResult.error || productResult.error;
  if (error) {
    setMessage(catalogMessage, "Couldn't load products: " + error.message, true);
    return;
  }
  categories = categoryResult.data;
  products = productResult.data;
  drawCatalog();
}

function drawCatalog() {
  const boxes = categories.map((category, index) =>
    makeCategoryBox(category, products.filter((p) => p.category_id === category.id), index));

  // Products not in any category get their own box at the end
  const loose = products.filter((p) => p.category_id === null);
  if (loose.length > 0) boxes.push(makeCategoryBox(null, loose));

  if (boxes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "No categories yet. Add your first one above, e.g. \"Drinks\".";
    boxes.push(empty);
  }
  categoryList.replaceChildren(...boxes);
}

// Small helper: makes a <button> with an icon and/or text
function makeButton(text, className, onClick, iconClass, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
  }
  if (text) button.append(document.createTextNode((iconClass ? " " : "") + text));
  if (label) button.setAttribute("aria-label", label);   // for icon-only buttons
  button.addEventListener("click", onClick);
  return button;
}

// One category box: heading + tools, its products, "Add product" button.
// category = null builds the "Not in a category" box.
function makeCategoryBox(category, items, index) {
  const box = document.createElement("section");
  box.className = "admin-card category-box";

  const head = document.createElement("div");
  head.className = "category-head";

  const title = document.createElement("h3");
  title.textContent = category ? category.name : "Not in a category";
  const count = document.createElement("span");
  count.className = "category-count";
  count.textContent = items.length === 1 ? "1 product" : `${items.length} products`;
  title.append(" ", count);
  head.append(title);

  if (category) {
    const ghost = "admin-btn admin-btn-ghost admin-btn-small";
    // Plain ↑ ↓ characters, so the arrows show even if the icon library fails
    const up = makeButton("↑", ghost, () => moveCategory(index, -1), null, `Move ${category.name} up`);
    const down = makeButton("↓", ghost, () => moveCategory(index, 1), null, `Move ${category.name} down`);
    up.disabled = index === 0;
    down.disabled = index === categories.length - 1;

    const tools = document.createElement("div");
    tools.className = "category-tools";
    tools.append(
      up, down,
      makeButton("Rename", ghost, () => renameCategory(category)),
      makeButton("Delete", "admin-btn admin-btn-danger admin-btn-small", () => deleteCategory(category, items.length)),
    );
    head.append(tools);
  } else {
    const hint = document.createElement("p");
    hint.className = "admin-hint";
    hint.textContent = "Shown under \"Other\" on the site. Edit a product to put it in a category.";
    head.append(hint);
  }

  const list = document.createElement("ul");
  list.className = "admin-product-list";
  list.append(...items.map(makeProductRow));
  box.append(head, list);

  if (category) {
    box.append(makeButton(`Add product to ${category.name}`, "admin-btn admin-btn-small add-product-btn",
      () => openProductDialog(null, category.id), "fa-solid fa-plus"));
  }
  return box;
}

// One product row: photo, name, price, Edit, Delete
function makeProductRow(product) {
  const li = document.createElement("li");
  li.className = "admin-product";

  const img = document.createElement("img");
  img.src = product.image_url || "images/logo.png";
  img.alt = "";
  if (!product.image_url) img.classList.add("no-photo");

  const info = document.createElement("div");
  info.className = "admin-product-info";
  const name = document.createElement("strong");
  name.textContent = product.name;
  const price = document.createElement("span");
  price.textContent = "$" + Number(product.price).toFixed(2);   // 3.5 → $3.50
  info.append(name, price);

  const actions = document.createElement("div");
  actions.className = "admin-product-actions";
  actions.append(
    makeButton("Edit", "admin-btn admin-btn-ghost admin-btn-small", () => openProductDialog(product)),
    makeButton("Delete", "admin-btn admin-btn-danger admin-btn-small", () => deleteProduct(product)),
  );

  li.append(img, info, actions);
  return li;
}


// ===== 6. Categories: add, rename, move, delete =====
const categoryForm = document.getElementById("category-form");
const categoryName = document.getElementById("category-name");

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = categoryName.value.trim();
  if (!name) return;
  const button = categoryForm.querySelector("button");
  setBusy(button, true, "Adding…");

  // New categories go at the end: one more than the biggest sort_order
  const lastOrder = Math.max(0, ...categories.map((c) => c.sort_order));
  const { error } = await db.from("categories").insert({ name, sort_order: lastOrder + 1 });

  setBusy(button, false);
  if (error) {
    setMessage(catalogMessage, "Couldn't add it: " + error.message, true);
    return;
  }
  categoryForm.reset();
  setMessage(catalogMessage, `Added "${name}". Now add products to it below.`);
  await loadCatalog();
});

async function renameCategory(category) {
  // prompt() shows the browser's box with a text field
  const name = prompt("New name for this category:", category.name);
  if (name === null || !name.trim() || name.trim() === category.name) return;

  const { data, error } = await db.from("categories")
    .update({ name: name.trim() }).eq("id", category.id).select();
  if (error || data.length === 0) {
    setMessage(catalogMessage, "Couldn't rename: " + (error || blockedError()).message, true);
    return;
  }
  setMessage(catalogMessage, `Renamed to "${name.trim()}".`);
  await loadCatalog();
}

// direction: -1 = up, 1 = down
async function moveCategory(index, direction) {
  const newOrder = [...categories];   // copy of the list
  const target = index + direction;
  // Swap the two neighbours
  [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];

  // Save each category's new position (1, 2, 3, ...) if it changed
  const updates = newOrder
    .map((category, i) => ({ category, position: i + 1 }))
    .filter(({ category, position }) => category.sort_order !== position)
    .map(({ category, position }) =>
      db.from("categories").update({ sort_order: position }).eq("id", category.id));

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed) setMessage(catalogMessage, "Couldn't move it: " + failed.error.message, true);
  await loadCatalog();
}

async function deleteCategory(category, productCount) {
  const extra = productCount > 0
    ? `\n\nIts ${productCount} product(s) won't be deleted. They'll move to "Not in a category".`
    : "";
  if (!confirm(`Delete the category "${category.name}"?${extra}`)) return;

  const { data, error } = await db.from("categories").delete().eq("id", category.id).select();
  if (error || data.length === 0) {
    setMessage(catalogMessage, "Couldn't delete: " + (error || blockedError()).message, true);
    return;
  }
  setMessage(catalogMessage, `Deleted "${category.name}".`);
  await loadCatalog();
}


// ===== 7. Product pop-up: add / edit =====
const productDialog = document.getElementById("product-dialog");
const productForm = document.getElementById("product-form");
const productDialogTitle = document.getElementById("product-dialog-title");
const productId = document.getElementById("product-id");
const productCategory = document.getElementById("product-category");
const productName = document.getElementById("product-name");
const productDescription = document.getElementById("product-description");
const productPrice = document.getElementById("product-price");
const productImage = document.getElementById("product-image");
const productPreview = document.getElementById("product-image-preview");
const productSaveBtn = document.getElementById("product-save-btn");
const productMessage = document.getElementById("product-message");

// Fills the Category dropdown with the current categories
function fillCategoryOptions(selectedId) {
  const none = new Option("— Not in a category —", "");
  const options = categories.map((c) => new Option(c.name, c.id));
  productCategory.replaceChildren(none, ...options);
  productCategory.value = selectedId ?? "";
}

// product = null to add a new one (into categoryId), or a product to edit
function openProductDialog(product, categoryId = null) {
  productForm.reset();
  setMessage(productMessage, "");
  productPreview.hidden = true;

  if (product) {
    productDialogTitle.textContent = "Edit product";
    productSaveBtn.textContent = "Save changes";
    productId.value = product.id;
    productName.value = product.name;
    productDescription.value = product.description ?? "";
    productPrice.value = product.price;
    fillCategoryOptions(product.category_id);
    if (product.image_url) {
      productPreview.src = product.image_url;
      productPreview.hidden = false;
    }
  } else {
    productDialogTitle.textContent = "Add a product";
    productSaveBtn.textContent = "Add product";
    productId.value = "";
    fillCategoryOptions(categoryId);
  }

  productDialog.showModal();
  productName.focus();
}

document.getElementById("product-cancel-btn").addEventListener("click", () => productDialog.close());

// Show a picked photo straight away
productImage.addEventListener("change", () => {
  const file = productImage.files[0];
  if (file) {
    // createObjectURL makes a temporary link to the file on this computer
    productPreview.src = URL.createObjectURL(file);
    productPreview.hidden = false;
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const editingId = productId.value;   // "" when adding
  const file = productImage.files[0];
  setBusy(productSaveBtn, true);
  setMessage(productMessage, "");

  let newPhoto = null;
  try {
    const row = {
      name: productName.value.trim(),
      description: productDescription.value.trim(),
      price: Number(productPrice.value),
      category_id: productCategory.value ? Number(productCategory.value) : null,
    };

    // Only upload when a new photo was picked
    if (file) {
      newPhoto = await uploadPhoto(file, "products");
      row.image_url = newPhoto.url;
      row.image_path = newPhoto.path;
    }

    if (editingId) {
      const oldProduct = products.find((p) => String(p.id) === editingId);
      const { data, error } = await db.from("products").update(row).eq("id", editingId).select();
      if (error) throw error;
      if (data.length === 0) throw blockedError();
      if (newPhoto && oldProduct) await removePhoto(oldProduct.image_path);   // replaced
    } else {
      const { error } = await db.from("products").insert(row);
      if (error) throw error;
    }

    const where = categories.find((c) => c.id === row.category_id);
    setMessage(catalogMessage, `Saved "${row.name}"` + (where ? ` in ${where.name}.` : "."));
    productDialog.close();
    await loadCatalog();
  } catch (error) {
    // Saving failed after uploading: delete the photo so it isn't left behind
    if (newPhoto) await removePhoto(newPhoto.path);
    setMessage(productMessage, "Couldn't save: " + error.message, true);
  } finally {
    setBusy(productSaveBtn, false);
  }
});


// ===== 8. Products: delete =====
async function deleteProduct(product) {
  // confirm() shows the browser's OK / Cancel box
  if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;

  const { data, error } = await db.from("products").delete().eq("id", product.id).select();
  if (error || data.length === 0) {
    setMessage(catalogMessage, "Couldn't delete: " + (error || blockedError()).message, true);
    return;
  }
  await removePhoto(product.image_path);
  setMessage(catalogMessage, `Deleted "${product.name}".`);
  await loadCatalog();
}
