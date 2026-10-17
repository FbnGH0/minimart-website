/*
  site-common.js = small helpers used by more than one page
  (home page, products page and admin page). Loaded after
  supabase-config.js, because loadSettings() uses "db".
*/

// Gets the one row of site settings. Returns null if it can't be loaded,
// so pages can just keep the text already typed in their HTML.
async function loadSettings() {
  const { data, error } = await db
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .single();   // return one object, not a list
  return error ? null : data;
}

// Turns what the admin typed in "Map location" into a link the map
// <iframe> can show. It accepts either:
//   - a place, e.g. "Great Luck Myanmar Minimart, Toa Payoh"
//   - Google's embed code: <iframe src="https://www.google.com/maps/embed?..." ...>
function mapEmbedUrl(location) {
  const text = (location || "").trim();
  if (!text) return "";

  // Pasted embed code: pull out just the link inside src="...".
  // Only Google Maps links are allowed, so no other site can be shown here.
  const src = text.match(/src="([^"]+)"/);
  if (src) {
    const isGoogleMaps = /^https:\/\/(www\.google\.com\/maps|maps\.google\.com)\//.test(src[1]);
    return isGoogleMaps ? src[1] : "";
  }

  // A plain place: let Google Maps search for it.
  // encodeURIComponent makes spaces, commas and # safe inside a link.
  return "https://maps.google.com/maps?q=" + encodeURIComponent(text) + "&z=17&output=embed";
}

// Turns "8673 2131" into "6586732131" for tel: and WhatsApp links.
// Removes spaces and symbols, and adds Singapore's 65 to 8-digit numbers.
function toInternational(number) {
  const digits = (number || "").replace(/\D/g, "");   // \D = anything not a digit
  return digits.length === 8 ? "65" + digits : digits;
}

// Swaps the hero background for the photo uploaded in the admin.
// style.css reads the --hero-image variable; if it's not set, the
// original images/hero.jpg is used.
function applyHeroImage(settings) {
  const hero = document.querySelector(".hero");
  if (hero && settings && settings.hero_image_url) {
    hero.style.setProperty("--hero-image", `url("${settings.hero_image_url}")`);
  }
}
