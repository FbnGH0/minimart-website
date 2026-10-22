/*
  home.js = fills index.html with the details saved on admin.html:
    - hero: tagline + background photo
    - Visit Us: description, address, hours, phone, WhatsApp, map
    - Follow Us: TikTok, Facebook and Instagram links (+ the TikTok feed)

  The text already typed in index.html stays as a backup: anything that
  can't be loaded, or was left empty in the admin, keeps its HTML version.
*/

// Puts text into an element, but only if there's something to put
function fillText(id, text) {
  const element = document.getElementById(id);
  if (element && text) element.textContent = text;
  return element;
}

// Only allow real web links (stops odd values like "javascript:...")
function isWebLink(url) {
  return /^https?:\/\//i.test(url || "");
}

// ----- Visit Us -----
function applyVisitUs(settings) {
  fillText("shop-description", settings.visit_description);
  fillText("shop-address", settings.address);
  fillText("shop-hours", settings.hours);

  // Phone and WhatsApp need their links updated, not just the text
  const phone = fillText("shop-phone", settings.phone);
  if (settings.phone) phone.href = "tel:+" + toInternational(settings.phone);

  const whatsapp = fillText("shop-whatsapp", settings.whatsapp);
  if (settings.whatsapp) whatsapp.href = "https://wa.me/" + toInternational(settings.whatsapp);

  // Map (mapEmbedUrl is in site-common.js)
  const mapUrl = mapEmbedUrl(settings.map_location);
  if (mapUrl) document.getElementById("shop-map").src = mapUrl;

  // "Check today's hours on Google" searches for the same place. If the
  // admin pasted embed code instead of a place, search the address.
  const place = settings.map_location && !settings.map_location.includes("<iframe")
    ? settings.map_location
    : settings.address;
  if (place) {
    document.getElementById("hours-link").href =
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place);
  }
}

// ----- TikTok -----
// The feed is TikTok's embed page in an <iframe>. If the admin saved a
// different TikTok link, point the button and the feed at that account.
function applyTikTok(url) {
  const handle = (url || "").match(/@([\w.-]+)/);   // "@great.luck.myanmar" → great.luck.myanmar
  if (!isWebLink(url) || !handle) return;

  document.getElementById("tiktok-link").href = url;
  const feed = document.getElementById("tiktok-feed");
  const newSrc = "https://www.tiktok.com/embed/@" + handle[1];
  if (feed.src !== newSrc) feed.src = newSrc;   // only reload if it changed
}

// ----- Facebook -----
function applyFacebook(url) {
  const button = document.getElementById("facebook-link");
  // Only touch it if the link actually changed, so the working
  // version in index.html is kept otherwise
  if (!isWebLink(url) || url === button.getAttribute("href")) return;

  button.href = url;
  document.getElementById("facebook-posts-link").href = url;
  document.getElementById("facebook-feed").src =
    "https://www.facebook.com/plugins/page.php?href=" + encodeURIComponent(url) +
    "&tabs&width=340&height=130&small_header=false" +
    "&adapt_container_width=true&hide_cover=false&show_facepile=false";
}

// ----- Instagram -----
// Swaps "In progress" for a real link once one is saved in the admin
function applyInstagram(url) {
  if (!isWebLink(url)) return;   // empty = keep "In progress"

  const column = document.getElementById("instagram-col");
  const handle = (url.match(/instagram\.com\/([^/?#]+)/) || [])[1];

  // The button
  const button = document.createElement("a");
  button.className = "social-btn instagram";
  button.href = url;
  button.target = "_blank";
  button.rel = "noopener";
  const icon = document.createElement("i");
  icon.className = "fa-brands fa-instagram";
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "Instagram";
  button.append(icon, label);
  column.querySelector(".social-btn").replaceWith(button);

  // The card below it (Instagram has no simple profile feed to embed)
  const card = document.createElement("div");
  card.className = "video-card instagram-card";
  const bigIcon = icon.cloneNode();
  bigIcon.classList.add("instagram-card-icon");
  const title = document.createElement("p");
  title.innerHTML = "<strong>Follow us on Instagram</strong>";   // fixed text, safe
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = handle ? "@" + handle : "See our posts";
  card.append(bigIcon, title, link);
  column.querySelector(".video-card").replaceWith(card);
}

// ----- Put it all together -----
async function loadHomePage() {
  const settings = await loadSettings();   // from site-common.js

  if (settings) {
    fillText("site-tagline", settings.tagline);
    applyHeroImage(settings);               // from site-common.js
    applyVisitUs(settings);
    applyTikTok(settings.tiktok_url);
    applyFacebook(settings.facebook_url);
    applyInstagram(settings.instagram_url);
  }
}

loadHomePage();
