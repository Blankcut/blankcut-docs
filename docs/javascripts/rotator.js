// Typewriter rotator for the home hero — cycles through what Meerkat takes
// care of for a connected repo. The first phrase must match the initial text
// in docs/index.md. Honors prefers-reduced-motion (leaves the initial text in
// place).
(function () {
  function start() {
    var el = document.getElementById("bc-rotator");
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // leave the server-rendered initial phrase
    }
    var phrases = [
      "builds and deploys",
      "secrets",
      "databases and storage",
      "scaling and health checks",
    ];
    var i = 0, j = 0, deleting = false;
    function tick() {
      var word = phrases[i];
      el.textContent = word.slice(0, j);
      if (!deleting && j < word.length) {
        j++;
        setTimeout(tick, 65);
      } else if (!deleting && j === word.length) {
        deleting = true;
        setTimeout(tick, 1500); // hold the full phrase
      } else if (deleting && j > 0) {
        j--;
        setTimeout(tick, 30);
      } else {
        deleting = false;
        i = (i + 1) % phrases.length;
        setTimeout(tick, 300);
      }
    }
    tick();
  }
  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);
})();
