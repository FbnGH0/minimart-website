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
