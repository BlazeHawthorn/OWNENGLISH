/* ==========================================================================
   OwnEnglish — Panel kursanta
   Ten sam kod dostępu co diagnoza pogłębiona (tabela diagnosis_codes) działa
   tu jako proste logowanie kursanta — bez zakładania osobnych kont. Po
   podaniu poprawnego, aktywnego kodu funkcja bazy danych
   get_student_portal_data() (patrz supabase-setup.sql, sekcja 17) zwraca
   TYLKO dane tego jednego kursanta: historię jego diagnoz oraz nadchodzące
   zajęcia z grafiku lektora, dopasowane po imieniu i nazwisku.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  var gateScreen = document.getElementById('gate-screen');
  var panelScreen = document.getElementById('panel-screen');
  var gateCode = document.getElementById('gate-code');
  var gateSubmit = document.getElementById('gate-submit');
  var gateError = document.getElementById('gate-error');
  var panelStudentName = document.getElementById('panel-student-name');
  var lessonsEl = document.getElementById('panel-lessons');
  var resultsEl = document.getElementById('panel-results');
  var logoutBtn = document.getElementById('panel-logout');

  if (!gateScreen) return; // strona jeszcze nie ma tej struktury — nic do zrobienia

  // ---------- ZAPAMIĘTANIE KODU DOSTĘPU W PRZEGLĄDARCE ----------
  // Żeby kursant nie musiał wpisywać kodu przy każdej wizycie. Kod trzymany
  // jest wyłącznie lokalnie w przeglądarce tego urządzenia (localStorage) —
  // nigdzie indziej nie jest zapisywany. "Wyloguj" go czyści.
  var STORAGE_KEY = 'ownenglish_panel_code';

  function getSavedCode() {
    try { return window.localStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }
  function saveCode(code) {
    try { window.localStorage.setItem(STORAGE_KEY, code); }
    catch (e) { /* np. tryb prywatny — trudno, po prostu nie zapamiętamy kodu */ }
  }
  function clearSavedCode() {
    try { window.localStorage.removeItem(STORAGE_KEY); }
    catch (e) { /* nic do wyczyszczenia */ }
  }

  // ---------- KARTA "SŁOWO NA DZIŚ" ----------
  function loadWordOfDay() {
    var card = document.querySelector('[data-word-of-day]');
    if (!card) return;
    client
      .from('words_of_day')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // zostaje statyczna karta z HTML
        var epochDay = Math.floor(Date.now() / 86400000);
        var word = res.data[epochDay % res.data.length];
        function setField(name, value) {
          if (!value) return;
          var f = card.querySelector('[data-word-field="' + name + '"]');
          if (f) f.textContent = value;
        }
        setField('word', word.word);
        setField('part_of_speech', word.part_of_speech);
        setField('pronunciation', word.pronunciation);
        setField('dialect_label', word.dialect_label);
        setField('definition', word.definition);
      })
      .catch(function () { /* zostaw statyczną kartę */ });
  }
  loadWordOfDay();

  // ---------- CYTAT MOTYWUJĄCY ----------
  // Cytaty są teraz edytowalne z panelu administratora (sekcja "Cytaty
  // motywujące", tabela motivational_quotes) — działa dokładnie tak samo
  // jak karta "Słowo na dziś": rotacja dzienna po opublikowanych wierszach
  // (ten sam dzień = ten sam cytat dla każdego, lista zapętla się od
  // początku, gdy się skończy). Poniższa lista to WYŁĄCZNIE zapasowy zestaw
  // na wypadek, gdyby tabela w bazie była jeszcze pusta (np. zanim
  // zaktualizowany plik supabase-setup.sql zostanie uruchomiony) albo gdyby
  // zapytanie się nie powiodło — wtedy panel i tak pokaże sensowny cytat
  // zamiast pustego miejsca.
  var FALLBACK_QUOTES = [
    { text: 'Kto nie zna języków obcych, nie wie nic o własnym.', author: 'Johann Wolfgang von Goethe' },
    { text: 'Gdy raz nauczysz się czytać, będziesz już na zawsze wolny.', author: 'Frederick Douglass' },
    { text: 'Wiedza jest bezwartościowa, dopóki nie wcielisz jej w życie.', author: 'Anton Czechow' },
    { text: 'Język jest mapą kultury. Mówi, skąd przybyli jej ludzie i dokąd zmierzają.', author: 'Rita Mae Brown' },
    { text: 'Język jest krwią duszy, w której rodzą się i rosną myśli.', author: 'Oliver Wendell Holmes' },
    { text: 'Żaden przyjaciel nie jest tak wierny jak książka.', author: 'Ernest Hemingway' },
    { text: 'Czytelnik przeżywa tysiąc żyć, zanim umrze. Ten, kto nigdy nie czyta, przeżywa tylko jedno.', author: 'George R.R. Martin' },
    { text: 'Rób, co możesz, dopóki nie wiesz lepiej. Gdy już wiesz lepiej — rób lepiej.', author: 'Maya Angelou' },
    { text: 'Nigdy nie jest się za starym, by wyznaczyć sobie nowy cel albo zamarzyć na nowo.', author: 'C.S. Lewis' },
    { text: 'Doświadczenie to imię, jakie każdy nadaje swoim błędom.', author: 'Oscar Wilde' },
    { text: 'Dwoma najpotężniejszymi wojownikami są cierpliwość i czas.', author: 'Lew Tołstoj' },
    { text: 'Osądzaj człowieka po jego pytaniach, a nie po odpowiedziach.', author: 'Wolter' },
    { text: 'Znajomość języków jest bramą do mądrości.', author: 'Roger Bacon' },
    { text: 'Mówić danym językiem — to przyjąć cały świat, całą kulturę.', author: 'Frantz Fanon' },
    { text: 'Im więcej czytasz, tym więcej wiesz. Im więcej się uczysz, tym dalej zajdziesz.', author: 'Dr. Seuss' },
    { text: 'Słowo „nie wiem” jest małe, ale lata na mocnych skrzydłach.', author: 'Wisława Szymborska' },
    { text: 'Człowiek, który nie czyta, nie ma żadnej przewagi nad tym, kto czytać nie potrafi.', author: 'Mark Twain' },
    { text: 'Zawsze wyobrażałem sobie raj jako rodzaj biblioteki.', author: 'Jorge Luis Borges' }
  ];

  function showQuote(textEl, authorEl, text, author) {
    textEl.textContent = '„' + text + '”';
    authorEl.textContent = author;
  }

  function showFallbackQuote(textEl, authorEl) {
    var epochDay = Math.floor(Date.now() / 86400000);
    var q = FALLBACK_QUOTES[epochDay % FALLBACK_QUOTES.length];
    showQuote(textEl, authorEl, q.text, q.author);
  }

  function loadDailyQuote() {
    var textEl = document.getElementById('panel-quote-text');
    var authorEl = document.getElementById('panel-quote-author');
    if (!textEl || !authorEl) return;
    client
      .from('motivational_quotes')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) { showFallbackQuote(textEl, authorEl); return; }
        var epochDay = Math.floor(Date.now() / 86400000);
        var q = res.data[epochDay % res.data.length];
        showQuote(textEl, authorEl, q.quote_text, q.author);
      })
      .catch(function () { showFallbackQuote(textEl, authorEl); });
  }
  loadDailyQuote();

  // ---------- QUIZ DNIA (czasy i konstrukcje gramatyczne) ----------
  // Stała baza 30 pytań (bez bazy danych) — rotacja dzienna tym samym
  // mechanizmem co "Słowo na dziś" i cytat: ten sam dzień = to samo pytanie
  // dla każdego, po 30 dniach lista zaczyna się od nowa. Odpowiedź od razu
  // pokazuje wynik: błędnie wybrana odpowiedź podświetla się na czerwono,
  // a poprawna — na zielono, równocześnie.
  var GRAMMAR_QUIZ = [
    { sentence: 'She goes to the gym every morning before work.', options: ['Present Simple', 'Present Continuous', 'Present Perfect', 'Past Simple'], correctIndex: 0, explanation: 'Czynność powtarzalna, rutynowa — sygnał: „every morning”.' },
    { sentence: 'I am currently reading a fascinating book about ancient Rome.', options: ['Present Simple', 'Present Continuous', 'Present Perfect Continuous', 'Past Continuous'], correctIndex: 1, explanation: 'Czynność trwająca w tej chwili — słowo „currently” i końcówka „-ing”.' },
    { sentence: 'They have already finished the project.', options: ['Past Simple', 'Present Perfect', 'Present Perfect Continuous', 'Past Perfect'], correctIndex: 1, explanation: 'Czynność zakończona z widocznym skutkiem teraz — „already” + have/has + III forma.' },
    { sentence: 'He has been working on this report since 9 a.m.', options: ['Present Perfect', 'Present Perfect Continuous', 'Past Continuous', 'Present Continuous'], correctIndex: 1, explanation: 'Podkreśla czas trwania czynności rozpoczętej w przeszłości i trwającej nadal — „since”.' },
    { sentence: 'We visited Paris last summer.', options: ['Present Perfect', 'Past Simple', 'Past Continuous', 'Past Perfect'], correctIndex: 1, explanation: 'Zakończona czynność w konkretnym momencie przeszłości — „last summer”.' },
    { sentence: 'I was cooking dinner when the phone rang.', options: ['Past Simple', 'Past Continuous', 'Past Perfect', 'Past Perfect Continuous'], correctIndex: 1, explanation: 'Czynność w trakcie trwania, przerwana inną czynnością — „when” + Past Simple.' },
    { sentence: 'By the time we arrived, the movie had already started.', options: ['Past Simple', 'Past Continuous', 'Past Perfect', 'Present Perfect'], correctIndex: 2, explanation: 'Czynność wcześniejsza od innej czynności w przeszłości — „by the time”.' },
    { sentence: 'She had been studying for three hours before she took a break.', options: ['Past Perfect', 'Past Perfect Continuous', 'Present Perfect Continuous', 'Past Continuous'], correctIndex: 1, explanation: 'Podkreśla czas trwania czynności, która trwała aż do innego momentu w przeszłości.' },
    { sentence: 'I will call you as soon as I arrive.', options: ['Future Simple', 'Future Continuous', 'Future Perfect', 'Present Simple'], correctIndex: 0, explanation: 'Spontaniczna decyzja lub obietnica dotycząca przyszłości — „will”.' },
    { sentence: 'This time next week, I will be lying on a beach.', options: ['Future Simple', 'Future Continuous', 'Future Perfect', 'Going to Future'], correctIndex: 1, explanation: 'Czynność w trakcie trwania w konkretnym momencie przyszłości.' },
    { sentence: 'By next year, she will have graduated from university.', options: ['Future Simple', 'Future Continuous', 'Future Perfect', 'Future Perfect Continuous'], correctIndex: 2, explanation: 'Czynność zakończona przed określonym momentem w przyszłości — „by next year”.' },
    { sentence: "I'm going to start my own business next year.", options: ['Future Simple', 'Going to Future', 'Present Continuous', 'Future Continuous'], correctIndex: 1, explanation: 'Wcześniej podjęty plan lub zamiar — „going to”.' },
    { sentence: 'My train leaves at 6 p.m. tomorrow.', options: ['Present Simple (rozkład jazdy)', 'Present Continuous', 'Future Simple', 'Going to Future'], correctIndex: 0, explanation: 'Present Simple używany dla ustalonych rozkładów jazdy i planów instytucjonalnych.' },
    { sentence: "I'm meeting my dentist on Friday.", options: ['Present Simple (rozkład jazdy)', 'Present Continuous (plan na przyszłość)', 'Future Simple', 'Going to Future'], correctIndex: 1, explanation: 'Present Continuous dla wcześniej umówionych planów z konkretnym terminem.' },
    { sentence: 'If it rains, we will stay at home.', options: ['Zero Conditional', 'First Conditional', 'Second Conditional', 'Third Conditional'], correctIndex: 1, explanation: 'Realny warunek dotyczący przyszłości — If + Present Simple, will + bezokolicznik.' },
    { sentence: 'If I had more money, I would travel the world.', options: ['First Conditional', 'Second Conditional', 'Third Conditional', 'Mixed Conditional'], correctIndex: 1, explanation: 'Nierealna, hipotetyczna sytuacja w teraźniejszości — If + Past Simple, would + bezokolicznik.' },
    { sentence: 'If she had studied harder, she would have passed the exam.', options: ['First Conditional', 'Second Conditional', 'Third Conditional', 'Zero Conditional'], correctIndex: 2, explanation: 'Nierealna sytuacja w przeszłości — If + Past Perfect, would have + III forma.' },
    { sentence: 'If you heat water to 100°C, it boils.', options: ['Zero Conditional', 'First Conditional', 'Second Conditional', 'Third Conditional'], correctIndex: 0, explanation: 'Ogólna prawda / fakt naukowy — If + Present Simple, Present Simple.' },
    { sentence: 'The new bridge was built in 2015.', options: ['Active Voice', 'Present Passive', 'Past Passive', 'Present Perfect Passive'], correctIndex: 2, explanation: 'Strona bierna w czasie przeszłym — was/were + III forma, akcent na obiekt, nie wykonawcę.' },
    { sentence: 'This product is manufactured in Germany.', options: ['Active Voice', 'Present Simple Passive', 'Past Passive', 'Present Continuous Passive'], correctIndex: 1, explanation: 'Strona bierna w czasie teraźniejszym prostym — is/are + III forma.' },
    { sentence: 'She said that she was tired.', options: ['Direct Speech', 'Reported Speech', 'Present Perfect', 'Past Continuous'], correctIndex: 1, explanation: 'Mowa zależna — czas cofnięty o jeden stopień wstecz względem wypowiedzi oryginalnej.' },
    { sentence: "He must have missed the bus — that's why he's late.", options: ['Modal wyrażający obowiązek', 'Modal wyrażający przypuszczenie (przeszłość)', 'Modal wyrażający umiejętność', 'Modal wyrażający pozwolenie'], correctIndex: 1, explanation: '„Must have” + III forma wyraża pewne przypuszczenie dotyczące przeszłości.' },
    { sentence: 'I used to play the piano when I was a child.', options: ['Past Simple (nawyk)', 'Used to (nawyk w przeszłości)', 'Past Continuous', 'Present Perfect'], correctIndex: 1, explanation: '„Used to” opisuje nawyk lub stan z przeszłości, który już nie trwa.' },
    { sentence: "I'm not used to waking up so early.", options: ['Used to (nawyk w przeszłości)', 'Be used to (przyzwyczajenie)', 'Get used to', 'Would (nawyk w przeszłości)'], correctIndex: 1, explanation: '„Be used to” + rzeczownik/gerund oznacza przyzwyczajenie do czegoś, nie nawyk z przeszłości.' },
    { sentence: 'I enjoy learning new languages.', options: ['Czasownik + bezokolicznik', 'Czasownik + gerund (-ing)', 'Modal + bezokolicznik', 'Present Continuous'], correctIndex: 1, explanation: 'Czasownik „enjoy” wymaga po sobie formy -ing (gerund).' },
    { sentence: 'She decided to move to another city.', options: ['Czasownik + gerund (-ing)', 'Czasownik + bezokolicznik', 'Modal + bezokolicznik', 'Present Perfect'], correctIndex: 1, explanation: 'Czasownik „decide” łączy się z bezokolicznikiem (to + verb).' },
    { sentence: 'The book that I borrowed from the library is overdue.', options: ['Zdanie względne nieokreślające', 'Zdanie względne określające', 'Mowa zależna', 'Strona bierna'], correctIndex: 1, explanation: 'Zdanie względne określające — informacja niezbędna, by wiedzieć, o którą książkę chodzi.' },
    { sentence: 'I had my car repaired last week.', options: ['Strona bierna', 'Konstrukcja przyczynowa (have something done)', 'Mowa zależna', 'Past Perfect'], correctIndex: 1, explanation: 'Konstrukcja przyczynowa — zlecamy komuś wykonanie czynności zamiast robić ją samemu.' },
    { sentence: "You've been to Italy, haven't you?", options: ['Question tag', 'Mowa zależna', 'Strona bierna', 'Tryb warunkowy'], correctIndex: 0, explanation: 'Question tag — krótkie pytanie potwierdzające dołączone na końcu zdania.' },
    { sentence: 'By the time she retires, she will have been teaching for 40 years.', options: ['Future Perfect', 'Future Perfect Continuous', 'Future Continuous', 'Past Perfect Continuous'], correctIndex: 1, explanation: 'Podkreśla długość trwania czynności, aż do punktu w przyszłości.' }
  ];

  function loadDailyQuiz() {
    var sentenceEl = document.getElementById('quiz-sentence');
    var optionsEl = document.getElementById('quiz-options');
    var feedbackEl = document.getElementById('quiz-feedback');
    if (!sentenceEl || !optionsEl || !feedbackEl) return;

    var epochDay = Math.floor(Date.now() / 86400000);
    var q = GRAMMAR_QUIZ[epochDay % GRAMMAR_QUIZ.length];
    sentenceEl.textContent = '„' + q.sentence + '”';
    optionsEl.innerHTML = '';
    feedbackEl.style.display = 'none';
    var answered = false;

    q.options.forEach(function (opt, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline btn-sm';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var buttons = optionsEl.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].disabled = true;
          if (i === q.correctIndex) {
            buttons[i].style.background = '#DDF3E4';
            buttons[i].style.borderColor = '#16A34A';
            buttons[i].style.color = '#0F7D3A';
          }
        }
        if (idx !== q.correctIndex) {
          btn.style.background = '#FBEAEA';
          btn.style.borderColor = '#B3261E';
          btn.style.color = '#B3261E';
        }
        feedbackEl.style.display = 'block';
        if (idx === q.correctIndex) {
          feedbackEl.style.color = '#0F7D3A';
          feedbackEl.textContent = 'Brawo, poprawna odpowiedź! ' + (q.explanation || '');
        } else {
          feedbackEl.style.color = '#B3261E';
          feedbackEl.textContent = 'Niepoprawnie — poprawna odpowiedź to: ' + q.options[q.correctIndex] + '. ' + (q.explanation || '');
        }
      });
      optionsEl.appendChild(btn);
    });
  }
  loadDailyQuiz();

  function showGateError(msg) {
    gateError.textContent = msg;
    gateError.style.display = 'block';
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var MONTH_NAMES = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

  function formatDate(iso) {
    var parts = (iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return iso;
    var dayName = DAY_NAMES[d.getDay()];
    return dayName.charAt(0).toUpperCase() + dayName.slice(1) + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  }

  function renderLessons(lessons) {
    lessonsEl.innerHTML = '';
    if (!lessons || !lessons.length) {
      lessonsEl.appendChild(el('p', 'text-muted', 'Nie masz jeszcze żadnych zaplanowanych zajęć w grafiku. Jeśli się już umówiliście, a nie widzisz ich tutaj — daj znać swojemu lektorowi, upewni się, że Twoje imię i nazwisko jest wpisane tak samo jak przy kodzie dostępu.'));
      return;
    }
    lessons.forEach(function (l) {
      var row = el('div', 'admin-row');
      var when = formatDate(l.lesson_date) + (l.lesson_time ? ', godz. ' + escapeHtml(l.lesson_time) : '');
      row.appendChild(el('span', null, '<b>' + when + '</b>'));
      row.appendChild(el('span', 'text-muted', (l.duration_minutes || 60) + ' min'));
      lessonsEl.appendChild(row);
    });
  }

  var TEST_LABELS = { ogolny: 'Test ogólny', biznesowy: 'Test biznesowy' };
  var SKILL_LABELS = { grammar: 'Gramatyka', vocabulary: 'Słownictwo', reading: 'Czytanie', listening: 'Słuchanie', writing: 'Pisanie', speaking: 'Mówienie' };
  // Tylko "czyste" poziomy CEFR da się jednoznacznie porównać (np. "poniżej A2"
  // albo "A1–A2" to widełki, nie da się ich rzetelnie zestawić z inną datą).
  var LEVEL_BASE = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

  function printResult(r) {
    var win = window.open('', '_blank', 'width=760,height=960');
    if (!win) {
      window.alert('Przeglądarka zablokowała otwieranie nowego okna. Zezwól na wyskakujące okienka dla tej strony i spróbuj ponownie.');
      return;
    }
    var dateStr = (r.created_at || '').slice(0, 10);
    var rows = Object.keys(SKILL_LABELS).map(function (key) {
      var lvl = r.levels && r.levels[key];
      if (!lvl) return '';
      return '<tr><td style="padding:6px 12px 6px 0; color:#6B655D;">' + escapeHtml(SKILL_LABELS[key]) + '</td><td style="padding:6px 0; font-weight:600;">' + escapeHtml(lvl) + '</td></tr>';
    }).join('');
    var html = '<!doctype html><html lang="pl"><head><meta charset="utf-8">' +
      '<title>Wynik diagnozy — ' + escapeHtml(dateStr) + '</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;color:#1C1A18;padding:32px;max-width:680px;margin:0 auto;}' +
      'h1{font-size:19px;margin:0 0 2px;}.muted{color:#6B655D;font-size:13px;margin-bottom:22px;}' +
      'table{border-collapse:collapse;margin-bottom:22px;}' +
      'pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.55;border-top:1px solid #e5e2df;padding-top:16px;}' +
      '@media print{body{padding:0;}}</style></head><body>' +
      '<h1>OwnEnglish — wynik diagnozy</h1>' +
      '<div class="muted">' + escapeHtml(TEST_LABELS[r.test_type] || r.test_type || 'Test') + ' — ' + escapeHtml(dateStr) + '</div>' +
      '<table>' + rows + '</table>' +
      '<pre>' + escapeHtml(r.report_text || '') + '</pre>' +
      '</body></html>';
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 300);
  }

  function renderResults(results) {
    resultsEl.innerHTML = '';
    if (!results || !results.length) {
      resultsEl.appendChild(el('p', 'text-muted', 'Nie masz jeszcze żadnego wyniku — możesz zrobić test diagnostyczny przyciskiem poniżej.'));
      return;
    }

    // Grupowanie po typie testu (ogólny / biznesowy), żeby porównywać
    // postęp między testami tego samego rodzaju, a nie różnych.
    var byType = {};
    results.forEach(function (r) {
      var t = r.test_type || '';
      if (!byType[t]) byType[t] = [];
      byType[t].push(r);
    });
    Object.keys(byType).forEach(function (t) {
      byType[t].sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    });

    results.forEach(function (r) {
      var det = el('details', 'diag-lvl');
      var sum = el('summary');
      var dateStr = (r.created_at || '').slice(0, 10);
      sum.appendChild(el('span', null, '<b>' + escapeHtml(TEST_LABELS[r.test_type] || r.test_type || 'Test') + '</b> — ' + escapeHtml(dateStr)));
      det.appendChild(sum);
      var inner = el('div'); inner.style.padding = '0 16px 14px';
      var chips = el('div', 'row-wrap'); chips.style.gap = '8px'; chips.style.marginTop = '4px';

      var sameType = byType[r.test_type || ''] || [r];
      var prev = sameType[sameType.indexOf(r) + 1]; // starszy wynik tego samego typu testu

      Object.keys(SKILL_LABELS).forEach(function (key) {
        var lvl = r.levels && r.levels[key];
        if (!lvl) return;
        var chip = el('span', 'badge badge-tint', escapeHtml(SKILL_LABELS[key]) + ': ' + escapeHtml(lvl));
        if (prev) {
          var prevLvl = prev.levels && prev.levels[key];
          if (LEVEL_BASE.hasOwnProperty(lvl) && LEVEL_BASE.hasOwnProperty(prevLvl) && lvl !== prevLvl) {
            var up = LEVEL_BASE[lvl] > LEVEL_BASE[prevLvl];
            var arrow = document.createElement('span');
            arrow.textContent = up ? ' ↑' : ' ↓';
            arrow.style.color = up ? 'var(--color-accent-dark)' : '#B3261E';
            arrow.style.fontWeight = '700';
            arrow.title = (up ? 'Postęp' : 'Spadek') + ' względem poprzedniego testu: ' + prevLvl + ' → ' + lvl;
            chip.appendChild(arrow);
          }
        }
        chips.appendChild(chip);
      });
      inner.appendChild(chips);
      var ta = el('textarea'); ta.readOnly = true; ta.rows = 8; ta.style.marginTop = '14px'; ta.value = r.report_text || '';
      inner.appendChild(ta);
      var printBtn = el('button', 'btn btn-outline btn-sm', 'Pobierz jako PDF');
      printBtn.type = 'button';
      printBtn.style.marginTop = '10px';
      printBtn.addEventListener('click', function () { printResult(r); });
      inner.appendChild(printBtn);
      det.appendChild(inner);
      resultsEl.appendChild(det);
    });
  }

  function submitCode(opts) {
    var silent = !!(opts && opts.silent);
    var code = (gateCode.value || '').trim();
    if (!code) {
      if (!silent) showGateError('Wpisz kod dostępu.');
      return;
    }
    gateError.style.display = 'none';
    if (!silent) {
      gateSubmit.disabled = true;
      gateSubmit.textContent = 'Sprawdzam…';
    }
    client.rpc('get_student_portal_data', { p_code: code }).then(function (res) {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      if (res.error || !res.data || !res.data.length) {
        clearSavedCode();
        if (!silent) showGateError('Nieprawidłowy kod dostępu. Sprawdź, czy wpisałeś/aś go dokładnie tak, jak otrzymałeś/aś od lektora.');
        return;
      }
      saveCode(code);
      var row = res.data[0];
      panelStudentName.textContent = row.student_name || 'Kursancie';
      renderLessons(row.lessons || []);
      renderResults(row.results || []);
      gateScreen.style.display = 'none';
      panelScreen.style.display = 'block';
    }).catch(function () {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      if (!silent) showGateError('Błąd połączenia. Spróbuj ponownie za chwilę.');
    });
  }

  gateSubmit.addEventListener('click', function () { submitCode(); });
  gateCode.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitCode(); });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      clearSavedCode();
      gateCode.value = '';
      panelScreen.style.display = 'none';
      gateScreen.style.display = 'block';
    });
  }

  // Jeśli kod jest zapamiętany z poprzedniej wizyty, spróbuj wejść od razu,
  // bez pokazywania błędu, gdyby kod w międzyczasie przestał być aktywny.
  var savedCode = getSavedCode();
  if (savedCode) {
    gateCode.value = savedCode;
    submitCode({ silent: true });
  }
});
