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
