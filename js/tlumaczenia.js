/* ==========================================================================
   OwnEnglish — zakładka "Tłumaczenia": cennik kategorii, ankieta doboru
   kategorii i kalkulator wyceny (znaki / strony rozliczeniowe).
   Cennik wczytuje się z Supabase (tabela translation_pricing — edytowalna
   w panelu administratora), a gdy Supabase nie jest skonfigurowany albo
   zapytanie się nie powiedzie, kalkulator i ankieta działają dalej na
   sensownych wartościach domyślnych (ceny pokazują "do ustalenia" zamiast
   się wysypać) — dokładnie ta sama filozofia co reszta strony
   (js/site-content.js).
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var quizEl = document.getElementById('transl-quiz');
  if (!quizEl) return; // to nie jest strona "Tłumaczenia" — nic do zrobienia

  // ---------- KLIENT SUPABASE (opcjonalny) ----------
  function isConfigured() {
    return (
      window.SUPABASE_URL &&
      window.SUPABASE_ANON_KEY &&
      window.SUPABASE_URL.indexOf('TWOJ-PROJEKT') === -1 &&
      window.SUPABASE_URL.indexOf('supabase.co') !== -1
    );
  }
  function getClient() {
    if (!window.supabase || !isConfigured()) return null;
    try { return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); }
    catch (e) { return null; }
  }
  var client = getClient();

  // ---------- CENNIK (fallback, zanim/gdyby dane z bazy się nie wczytały) ----------
  var FALLBACK_PRICING = {
    zwykle: { label: 'Tłumaczenia zwykłe', page_size_chars: 1800, price_per_page: null },
    przysiegle: { label: 'Tłumaczenia przysięgłe', page_size_chars: 1125, price_per_page: null },
    specjalistyczne: { label: 'Tłumaczenia specjalistyczne', page_size_chars: 1800, price_per_page: null },
    marketingowe: { label: 'Tłumaczenia marketingowe i CV', page_size_chars: 1800, price_per_page: null }
  };
  var pricing = FALLBACK_PRICING;

  function formatPln(n) {
    return n.toFixed(2).replace('.', ',') + ' zł';
  }

  function formatPages(p) {
    var s = p.toFixed(1);
    if (s.slice(-2) === '.0') s = s.slice(0, -2);
    return s.replace('.', ',');
  }

  function renderPriceCards() {
    document.querySelectorAll('[data-translation-card]').forEach(function (card) {
      var key = card.getAttribute('data-translation-card');
      var info = pricing[key];
      if (!info) return;
      var priceEl = card.querySelector('[data-translation-field="price"]');
      var pageSizeEl = card.querySelector('[data-translation-field="page-size"]');
      if (priceEl) priceEl.textContent = info.price_per_page != null ? formatPln(info.price_per_page) : '[cena PLN]';
      if (pageSizeEl) pageSizeEl.textContent = '1 strona = ' + info.page_size_chars + ' znaków ze spacjami';
    });
  }

  function loadPricing(done) {
    if (!client) { done(); return; }
    client
      .from('translation_pricing')
      .select('*')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) { done(); return; }
        var next = {};
        res.data.forEach(function (r) {
          next[r.category_key] = {
            label: r.category_label,
            page_size_chars: r.page_size_chars,
            price_per_page: Number(r.price_per_page) > 0 ? Number(r.price_per_page) : null
          };
        });
        pricing = next;
        renderPriceCards();
        done();
      })
      .catch(function () { done(); });
  }

  // ---------- ANKIETA DOBORU KATEGORII ----------
  var quizError = document.getElementById('quiz-error');
  var quizSubmit = document.getElementById('quiz-submit');
  var quizResult = document.getElementById('quiz-result');
  var quizResultCategory = document.getElementById('quiz-result-category');
  var quizResultDesc = document.getElementById('quiz-result-desc');
  var quizToCalc = document.getElementById('quiz-to-calc');

  document.querySelectorAll('.quiz-option input[type="radio"]').forEach(function (input) {
    input.addEventListener('change', function () {
      var group = input.closest('[data-quiz-question]');
      if (group) group.querySelectorAll('.quiz-option').forEach(function (opt) { opt.classList.remove('is-checked'); });
      var opt = input.closest('.quiz-option');
      if (opt) opt.classList.add('is-checked');
    });
  });

  function getAnswer(name) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  // Kolejność sprawdzania ma znaczenie — poświadczenie i dokumenty urzędowe
  // wygrywają z resztą, bo od nich zależy, czy tłumaczenie w ogóle będzie
  // ważne dla urzędu/sądu, niezależnie od poziomu terminologii w tekście.
  var CATEGORY_INFO = {
    zwykle: 'Twój tekst nie wymaga specjalistycznej terminologii ani poświadczenia — wystarczy tłumaczenie zwykłe.',
    przysiegle: 'Dokument wymaga poświadczenia przez tłumacza przysięgłego, żeby był ważny w urzędzie, sądzie lub innej instytucji.',
    specjalistyczne: 'Tekst zawiera specjalistyczną terminologię branżową, która wymaga tłumacza znającego dany temat.',
    marketingowe: 'To tekst o charakterze marketingowym lub CV — liczy się nie tylko dosłowne znaczenie, ale i naturalne brzmienie.'
  };

  function decideCategory(rodzaj, poswiadczenie, terminologia) {
    if (poswiadczenie === 'tak') return 'przysiegle';
    if (rodzaj === 'urzedowy') return 'przysiegle';
    if (rodzaj === 'marketing') return 'marketingowe';
    if (rodzaj === 'prawne' || rodzaj === 'techniczny' || rodzaj === 'medyczny') return 'specjalistyczne';
    if (terminologia === 'wysoki') return 'specjalistyczne';
    return 'zwykle';
  }

  if (quizSubmit) {
    quizSubmit.addEventListener('click', function () {
      var rodzaj = getAnswer('quiz-rodzaj');
      var poswiadczenie = getAnswer('quiz-poswiadczenie');
      var terminologia = getAnswer('quiz-terminologia');
      if (!rodzaj || !poswiadczenie || !terminologia) {
        if (quizError) quizError.style.display = 'block';
        return;
      }
      if (quizError) quizError.style.display = 'none';

      var category = decideCategory(rodzaj, poswiadczenie, terminologia);
      var label = (pricing[category] && pricing[category].label) || category;
      quizResultCategory.textContent = label;
      quizResultDesc.textContent = CATEGORY_INFO[category];
      quizResult.style.display = 'block';
      quizResult.setAttribute('data-recommended-category', category);
      quizResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (quizToCalc) {
    quizToCalc.addEventListener('click', function () {
      var category = quizResult.getAttribute('data-recommended-category');
      if (category && calcCategory) {
        calcCategory.value = category;
        recalc();
      }
      var target = document.getElementById('kalkulator');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---------- KALKULATOR WYCENY ----------
  var calcCategory = document.getElementById('calc-category');
  var calcTabs = document.getElementById('calc-tabs');
  var calcModePaste = document.getElementById('calc-mode-paste');
  var calcModeChars = document.getElementById('calc-mode-chars');
  var calcModePages = document.getElementById('calc-mode-pages');
  var calcText = document.getElementById('calc-text');
  var calcTextCount = document.getElementById('calc-text-count');
  var calcCharsInput = document.getElementById('calc-chars-input');
  var calcPagesInput = document.getElementById('calc-pages-input');
  var calcRowChars = document.getElementById('calc-row-chars');
  var calcOutChars = document.getElementById('calc-out-chars');
  var calcOutPages = document.getElementById('calc-out-pages');
  var calcOutPricePage = document.getElementById('calc-out-price-page');
  var calcOutPriceTotal = document.getElementById('calc-out-price-total');

  var calcMode = 'paste';

  if (calcTabs) {
    calcTabs.querySelectorAll('[data-calc-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        calcMode = btn.getAttribute('data-calc-mode');
        calcTabs.querySelectorAll('[data-calc-mode]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        calcModePaste.style.display = calcMode === 'paste' ? 'block' : 'none';
        calcModeChars.style.display = calcMode === 'chars' ? 'block' : 'none';
        calcModePages.style.display = calcMode === 'pages' ? 'block' : 'none';
        calcRowChars.style.display = calcMode === 'pages' ? 'none' : 'flex';
        recalc();
      });
    });
  }

  // Zawsze zaokrąglamy w górę do najbliższej połówki strony (standard
  // przyjęty w branży tłumaczeniowej) — minimum 1 strona, jeśli w tekście
  // jest choć jeden znak.
  function roundUpToHalfPage(pages) {
    if (pages <= 0) return 0;
    return Math.max(Math.ceil(pages * 2) / 2, 1);
  }

  function recalc() {
    var category = calcCategory ? calcCategory.value : 'zwykle';
    var info = pricing[category] || FALLBACK_PRICING[category] || { page_size_chars: 1800, price_per_page: null };

    var chars = 0;
    var pages = 0;

    if (calcMode === 'pages') {
      pages = Math.max(0, parseFloat(calcPagesInput.value) || 0);
      chars = Math.round(pages * info.page_size_chars);
    } else {
      if (calcMode === 'paste') {
        chars = calcText.value.length;
        if (calcTextCount) calcTextCount.textContent = chars.toLocaleString('pl-PL');
      } else {
        chars = Math.max(0, parseInt(calcCharsInput.value, 10) || 0);
      }
      pages = roundUpToHalfPage(chars / info.page_size_chars);
    }

    var pricePerPage = info.price_per_page;
    var total = pricePerPage != null ? pages * pricePerPage : null;

    if (calcOutChars) calcOutChars.textContent = chars.toLocaleString('pl-PL');
    if (calcOutPages) calcOutPages.textContent = formatPages(pages);
    if (calcOutPricePage) calcOutPricePage.textContent = pricePerPage != null ? formatPln(pricePerPage) : 'do ustalenia';
    if (calcOutPriceTotal) calcOutPriceTotal.textContent = total != null ? formatPln(total) : 'do ustalenia';

    updateOrderForm(category, pages, total);
  }

  if (calcCategory) calcCategory.addEventListener('change', recalc);
  if (calcText) calcText.addEventListener('input', recalc);
  if (calcCharsInput) calcCharsInput.addEventListener('input', recalc);
  if (calcPagesInput) calcPagesInput.addEventListener('input', recalc);

  // ---------- FORMULARZ ZAMÓWIENIA WYCENY ----------
  // Wypełnia ukryte pola formularza "Zamów wycenę" (wysyłanego przez
  // js/kontakt-form.js jako mailto, tak jak formularze na kontakt.html),
  // żeby kategoria i szacunkowa cena z kalkulatora trafiły do wiadomości
  // automatycznie, bez przepisywania czegokolwiek przez klienta.
  var tlumKategoria = document.getElementById('tlum-kategoria');
  var tlumStrony = document.getElementById('tlum-strony');
  var tlumCena = document.getElementById('tlum-cena');
  var tlumSummary = document.getElementById('tlum-summary');

  function updateOrderForm(category, pages, total) {
    if (!tlumKategoria) return;
    var label = (pricing[category] && pricing[category].label) || category;
    tlumKategoria.value = label;
    tlumStrony.value = pages > 0 ? formatPages(pages) + ' str.' : '';
    tlumCena.value = total != null ? formatPln(total) : 'do ustalenia';
    if (tlumSummary) {
      tlumSummary.textContent = pages > 0
        ? 'Do wiadomości dołączymy: kategoria „' + label + '", ' + tlumStrony.value + ' rozliczeniowych, szacowana cena: ' + tlumCena.value + '.'
        : 'Kategoria i wycena z kalkulatora zostaną dołączone automatycznie po ich obliczeniu powyżej.';
    }
  }

  // Pierwsze przeliczenie od razu (na wartościach domyślnych/fallbackowych),
  // a po wczytaniu prawdziwego cennika z bazy — przeliczenie ponowne.
  recalc();
  loadPricing(function () { recalc(); });
});
