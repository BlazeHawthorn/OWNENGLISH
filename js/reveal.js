/* ==========================================================================
   OwnEnglish — subtelne wejście treści przy przewijaniu (reveal-on-scroll)
   Dodaje klasę .reveal do kart/sekcji i .is-visible, gdy wjadą w widok.
   Jeśli JS nie zadziała, treść pozostaje w pełni widoczna (brak klasy .reveal).
   ========================================================================== */

(function () {
  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    return;
  }

  var targets = document.querySelectorAll(
    ".grid > *, .faq-item, .word-card-wrap, .photo-frame, .card, .card-outline, .card-accent"
  );

  targets.forEach(function (el) {
    el.classList.add("reveal");
    var parent = el.parentElement;
    if (parent && parent.classList.contains("grid")) {
      var idx = Array.prototype.indexOf.call(parent.children, el);
      el.style.transitionDelay = Math.min(idx * 70, 280) + "ms";
    }
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
