/*
  products.js = fills products.html from Supabase:
    - the heading + description above the products
    - the hero background photo (if one was uploaded)
    - one section per category, each with its own grid of product cards

  Everything here is managed on admin.html. Empty categories are skipped,
  and products without a category go into an "Other" section at the end.
*/

const catalog = document.getElementById("catalog");
const categoryChips = document.getElementById("category-chips");

// Builds one product card. textContent (not innerHTML) keeps typed text
// as plain text, so nothing in it can run as code.
function makeProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = product.name;
  if (product.image_url) {
    img.src = product.image_url;
  } else {
    img.src = "images/logo.png";    // no photo yet: show the shop logo
    img.classList.add("no-photo");
  }

  const body = document.createElement("div");
  body.className = "product-body";

  const name = document.createElement("h3");
  name.textContent = product.name;
  body.append(name);

  if (product.description) {
    const description = document.createElement("p");
    description.textContent = product.description;
    body.append(description);
  }

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = "$" + Number(product.price).toFixed(2);   // 3.5 → $3.50
  body.append(price);

  card.append(img, body);
  return card;
}

// One category section: a heading, then a grid of its products.
// The id lets the quick links at the top jump straight to it.
function makeCategorySection(title, items, id) {
  const section = document.createElement("section");
  section.className = "category-section";
  section.id = id;

  const heading = document.createElement("h3");
  heading.className = "category-title";
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.className = "product-grid";
  grid.append(...items.map(makeProductCard));

  section.append(heading, grid);
  return section;
}

// A message shown in place of the products (empty or error)
function catalogMessage(text) {
  const p = document.createElement("p");
  p.className = "grid-message";
  p.textContent = text;
  return p;
}

// Puts text into an element, but only if there's something to put
function fillText(id, text) {
  const element = document.getElementById(id);
  if (element && text) element.textContent = text;
}

async function loadProductsPage() {
  // Ask for all three at once; Promise.all waits for every reply
  const [settings, categoryResult, productResult] = await Promise.all([
    loadSettings(),   // from site-common.js
    db.from("categories").select("id, name").order("sort_order").order("id"),
    db.from("products").select("name, description, price, image_url, category_id").order("created_at"),
  ]);

  // Page text + hero photo (the HTML's own text stays if settings failed)
  if (settings) {
    fillText("products-heading", settings.products_heading);
    fillText("products-description", settings.products_description);
    applyHeroImage(settings);
  }

  if (categoryResult.error || productResult.error) {
    catalog.replaceChildren(catalogMessage("Sorry, our products couldn't load right now. Please try again later."));
    return;
  }
  const categories = categoryResult.data;
  const products = productResult.data;

  // Build a section for each category that has products
  const sections = [];
  for (const category of categories) {
    const items = products.filter((p) => p.category_id === category.id);
    if (items.length > 0) {
      sections.push(makeCategorySection(category.name, items, `category-${category.id}`));
    }
  }

  // Products in no category (or in one that was deleted) go last
  const known = new Set(categories.map((c) => c.id));
  const others = products.filter((p) => !known.has(p.category_id));
  if (others.length > 0) {
    sections.push(makeCategorySection(sections.length ? "Other" : "Our products", others, "category-other"));
  }

  if (sections.length === 0) {
    catalog.replaceChildren(catalogMessage("New products are coming soon. Check back later!"));
    return;
  }
  catalog.replaceChildren(...sections);

  // Quick links to each section, only worth showing if there are 2+
  if (sections.length > 1) {
    const links = sections.map((section) => {
      const link = document.createElement("a");
      link.href = "#" + section.id;
      link.textContent = section.querySelector(".category-title").textContent;
      return link;
    });
    categoryChips.replaceChildren(...links);
    categoryChips.hidden = false;
  }
}

loadProductsPage();
