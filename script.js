/*
  script.js = BEHAVIOUR.
*/

// 1. Footer year, always up to date.
document.getElementById("year").textContent = new Date().getFullYear();

// 2. Scroll reveal.
//    An IntersectionObserver watches elements and tells us when they
//    enter the screen — no need to check scroll position ourselves.
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible"); // triggers the CSS fade-in
        observer.unobserve(entry.target);      // only animate once
      }
    });
  },
  { threshold: 0.2 } // fire when 20% of the element is visible
);

// Watch every element with class="reveal"
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// 3. Show the nav bar once you've scrolled (almost) past the hero.
const nav = document.querySelector(".site-nav");
const hero = document.querySelector(".hero");

function updateNav() {
  // window.scrollY = how far down the page you've scrolled, in pixels.
  // hero.offsetHeight = how tall the hero is.
  // The 120px leeway means the nav still shows if a small strip of the
  // hero is visible, e.g. right after clicking a nav link.
  const pastHero = window.scrollY >= hero.offsetHeight - 120;

  // toggle(className, condition) adds the class if condition is true,
  // removes it if false.
  nav.classList.toggle("show", pastHero);
}

// Check every time the page scrolls, and once when it first loads.
window.addEventListener("scroll", updateNav, { passive: true });
updateNav();

// 4. Google Translate.
//    Google's script (loaded at the bottom of index.html) calls this
//    function by name once it's ready. That's why the name must match the
//    "cb=googleTranslateElementInit" in the script's address.
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    {
      pageLanguage: "en",                       // the site is written in English
      includedLanguages: "en,my,zh-CN,ms,ta",   // English, Burmese, Chinese, Malay, Tamil
      // No "layout" option = Google's plain dropdown (<select>), which is
      // the most reliable version of the widget. It's hidden by CSS;
      // visitors use our own dropdown instead (part 5 below).
    },
    "google_translate_element"                   // id of the box to put it in
  );
}

// 5. Our own language dropdown, with each language written in itself.
const langSelect = document.getElementById("lang-select");

// Google remembers the chosen language in a cookie called "googtrans",
// e.g. "/en/my" means English → Burmese. If it's set, show that language
// as selected in our dropdown so it matches the page after a reload.
const savedLang = document.cookie.match(/googtrans=\/en\/([^;]+)/);
if (savedLang) {
  langSelect.value = decodeURIComponent(savedLang[1]);
}

langSelect.addEventListener("change", () => {
  const lang = langSelect.value;

  // Back to English: clear Google's cookie and reload the original page.
  // (This is more reliable than asking Google to "translate" to English.)
  if (lang === "en") {
    const expired = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = expired;
    document.cookie = expired + " domain=" + location.hostname + ";";
    location.reload();
    return;
  }

  // Any other language: find Google's hidden dropdown, set it to the same
  // language, and fire a "change" event so Google thinks a person picked it.
  const googleSelect = document.querySelector(".goog-te-combo");
  if (!googleSelect) return;   // Google's script hasn't finished loading yet
  googleSelect.value = lang;
  googleSelect.dispatchEvent(new Event("change"));
});