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

  if (!gateScreen) return; // strona jeszcze nie ma tej struktury — nic do zrobienia

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

  function renderResults(results) {
    resultsEl.innerHTML = '';
    if (!results || !results.length) {
      resultsEl.appendChild(el('p', 'text-muted', 'Nie masz jeszcze żadnego wyniku — możesz zrobić test diagnostyczny przyciskiem poniżej.'));
      return;
    }
    results.forEach(function (r) {
      var det = el('details', 'diag-lvl');
      var sum = el('summary');
      var dateStr = (r.created_at || '').slice(0, 10);
      sum.appendChild(el('span', null, '<b>' + escapeHtml(TEST_LABELS[r.test_type] || r.test_type || 'Test') + '</b> — ' + escapeHtml(dateStr)));
      det.appendChild(sum);
      var inner = el('div'); inner.style.padding = '0 16px 14px';
      var chips = el('div', 'row-wrap'); chips.style.gap = '8px'; chips.style.marginTop = '4px';
      Object.keys(SKILL_LABELS).forEach(function (key) {
        var lvl = r.levels && r.levels[key];
        if (!lvl) return;
        chips.appendChild(el('span', 'badge badge-tint', escapeHtml(SKILL_LABELS[key]) + ': ' + escapeHtml(lvl)));
      });
      inner.appendChild(chips);
      var ta = el('textarea'); ta.readOnly = true; ta.rows = 8; ta.style.marginTop = '14px'; ta.value = r.report_text || '';
      inner.appendChild(ta);
      det.appendChild(inner);
      resultsEl.appendChild(det);
    });
  }

  function submitCode() {
    var code = (gateCode.value || '').trim();
    if (!code) { showGateError('Wpisz kod dostępu.'); return; }
    gateError.style.display = 'none';
    gateSubmit.disabled = true;
    gateSubmit.textContent = 'Sprawdzam…';
    client.rpc('get_student_portal_data', { p_code: code }).then(function (res) {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      if (res.error || !res.data || !res.data.length) {
        showGateError('Nieprawidłowy kod dostępu. Sprawdź, czy wpisałeś/aś go dokładnie tak, jak otrzymałeś/aś od lektora.');
        return;
      }
      var row = res.data[0];
      panelStudentName.textContent = row.student_name || 'Kursancie';
      renderLessons(row.lessons || []);
      renderResults(row.results || []);
      gateScreen.style.display = 'none';
      panelScreen.style.display = 'block';
    }).catch(function () {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      showGateError('Błąd połączenia. Spróbuj ponownie za chwilę.');
    });
  }

  gateSubmit.addEventListener('click', submitCode);
  gateCode.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitCode(); });
});
