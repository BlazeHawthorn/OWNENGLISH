/* ==========================================================================
   OwnEnglish — test poziomujący
   Prosta samoocena "ceiling": sprawdzamy kolejno grupy A1 → C1; poziom rośnie,
   dopóki w danej grupie zaznaczone jest co najmniej 75% zdań. Pierwsza grupa,
   która nie spełnia progu, zatrzymuje wynik na ostatnim zaliczonym poziomie.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var quiz = document.getElementById('poziom-quiz');
  var submitBtn = document.getElementById('poziom-submit');
  var resetBtn = document.getElementById('poziom-reset');
  var resultBox = document.getElementById('poziom-result');
  var resultLevel = document.getElementById('poziom-result-level');
  var resultDesc = document.getElementById('poziom-result-desc');

  if (!quiz || !submitBtn || !resultBox) return;

  var ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];
  var THRESHOLD = 0.75;

  var LEVEL_INFO = {
    A1: 'Zaczynasz od podstaw — to świetny punkt startowy. Skupimy się na budowaniu pierwszego słownictwa i pewności siebie w najprostszych sytuacjach.',
    A2: 'Znasz podstawy i radzisz sobie w prostych, rutynowych sytuacjach. Pora rozszerzyć słownictwo i zacząć mówić dłuższymi zdaniami.',
    B1: 'Potrafisz porozumieć się w większości codziennych sytuacji. Skupimy się na płynności i pewności siebie w dłuższych rozmowach.',
    B2: 'Mówisz swobodnie i radzisz sobie w rozmowie z rodzimymi użytkownikami języka. Popracujemy nad precyzją, niuansami i bardziej złożonymi tematami.',
    C1: 'Twój angielski jest już zaawansowany — wyrażasz się płynnie i spontanicznie. Skupimy się na dopracowaniu szczegółów i specjalistycznym słownictwie.'
  };

  function computeLevel() {
    var achieved = null;
    for (var i = 0; i < ORDER.length; i++) {
      var level = ORDER[i];
      var group = quiz.querySelector('.level-group[data-level="' + level + '"]');
      if (!group) continue;
      var boxes = group.querySelectorAll('input[type="checkbox"]');
      var checked = group.querySelectorAll('input[type="checkbox"]:checked').length;
      var ratio = boxes.length ? checked / boxes.length : 0;
      if (ratio >= THRESHOLD) {
        achieved = level;
      } else {
        break;
      }
    }
    return achieved || 'A1';
  }

  submitBtn.addEventListener('click', function () {
    var level = computeLevel();
    resultLevel.textContent = level;
    resultDesc.textContent = LEVEL_INFO[level];
    resultBox.style.display = 'flex';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      var boxes = quiz.querySelectorAll('input[type="checkbox"]');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = false;
      }
      resultBox.style.display = 'none';
      quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
});
