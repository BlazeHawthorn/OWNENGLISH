/* ==========================================================================
   OwnEnglish — panel administracyjny i panel lektora (logowanie + edycja
   treści w Supabase)
   Ta strona (admin.html) NIE jest linkowana z publicznej nawigacji —
   dostęp tylko po znajomości adresu. Prawdziwym zabezpieczeniem NIE jest
   ukrycie linku, tylko reguły dostępu (RLS) w Supabase: kto co widzi
   i może zapisać, zależy od roli konta (administrator / lektor) — patrz
   supabase-setup.sql. Ta sama strona logowania obsługuje obie role:
   po zalogowaniu skrypt sam sprawdza rolę i pokazuje właściwy panel.
   ========================================================================== */

(function () {
  var loginSection = document.getElementById('admin-login');
  var dashboardSection = document.getElementById('admin-dashboard');
  var tutorDashboardSection = document.getElementById('tutor-dashboard');
  var loginForm = document.getElementById('admin-login-form');
  var loginError = document.getElementById('admin-login-error');
  var registerForm = document.getElementById('tutor-register-form');
  var registerError = document.getElementById('register-error');
  var registerSuccess = document.getElementById('register-success');
  var authModeToggle = document.getElementById('auth-mode-toggle');
  var authHeading = document.getElementById('auth-heading');
  var authSubtitle = document.getElementById('auth-subtitle');
  var logoutBtn = document.getElementById('admin-logout');
  var configWarning = document.getElementById('admin-config-warning');
  var globalMessage = document.getElementById('admin-global-message');

  function isConfigured() {
    return (
      window.SUPABASE_URL &&
      window.SUPABASE_ANON_KEY &&
      window.SUPABASE_URL.indexOf('TWOJ-PROJEKT') === -1 &&
      window.SUPABASE_URL.indexOf('supabase.co') !== -1
    );
  }

  if (!isConfigured() || !window.supabase) {
    configWarning.style.display = 'block';
    loginForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var currentTutorRow = null; // profil lektora aktualnie zalogowanej osoby (null dla admina)
  var currentAdminUserId = null; // auth.uid() zalogowanego administratora (null dla lektora)
  var currentHourlyRate = 0; // stawka za godzinę administratora (do "Podsumowania miesiąca")
  var summaryMonthStart = null; // 'RRRR-MM-01' — miesiąc aktualnie pokazywany w podsumowaniu
  var latestMyScheduleRows = []; // ostatnio wczytane własne zajęcia administratora (do podsumowania)
  var studentRatesMap = {}; // stawki indywidualne: klucz to lower(trim(imię i nazwisko)) -> stawka za godzinę

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showMessage(el, text, kind) {
    el.textContent = text;
    el.className = 'admin-message is-' + kind;
    el.style.display = 'block';
    if (kind === 'success') {
      setTimeout(function () { el.style.display = 'none'; }, 3000);
    }
  }

  // Rozwijana lista statusu zajęć — używana w trzech miejscach: własny
  // grafik lektora, "Mój grafik" admina, "Grafik zajęć — wszyscy lektorzy"
  // i widget "Dzisiejsze zajęcia". Klikalna od razu na liście (bez osobnego
  // przycisku "Zapisz") — zmiana zapisuje się w bazie od razu po wyborze.
  function lessonStatusSelectHtml(status) {
    var s = status || 'planned';
    return (
      '<select class="btn-outline btn-xs" data-action="set-status" style="min-width:130px;">' +
      '<option value="planned"' + (s === 'planned' ? ' selected' : '') + '>Zaplanowane</option>' +
      '<option value="completed"' + (s === 'completed' ? ' selected' : '') + '>Odbyte</option>' +
      '<option value="cancelled"' + (s === 'cancelled' ? ' selected' : '') + '>Odwołane</option>' +
      '</select>'
    );
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = '0' + m;
    var day = String(d.getDate());
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Dodaje "days" dni do daty w formacie "RRRR-MM-DD" i zwraca ją w tym
  // samym formacie — używane przy "powtarzaniu" zajęć co tydzień.
  function addDaysToIsoDate(iso, days) {
    var parts = iso.split('-');
    var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    d.setUTCDate(d.getUTCDate() + days);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1);
    if (m.length < 2) m = '0' + m;
    var day = String(d.getUTCDate());
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
  }

  // Zamienia jeden wpis grafiku na kilka (co tydzień, ta sama godzina i
  // uczeń) — dla lekcji, które odbywają się regularnie w tym samym terminie.
  // "weeks" to liczba wystąpień łącznie z pierwszym (1 = bez powtarzania).
  // Wspólny identyfikator dla wszystkich wystąpień jednej serii "Powtarzaj"
  // — dzięki niemu przycisk "Usuń całą serię" może je usunąć jednym
  // kliknięciem. Pojedyncze (niepowtarzające się) zajęcia go nie dostają.
  function generateSeriesId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'series-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function buildRecurringLessonRows(basePayload, weeks) {
    var count = (weeks && weeks > 1) ? weeks : 1;
    var seriesId = count > 1 ? generateSeriesId() : null;
    var rows = [];
    for (var i = 0; i < count; i++) {
      var row = Object.assign({}, basePayload);
      row.lesson_date = addDaysToIsoDate(basePayload.lesson_date, i * 7);
      if (seriesId) row.series_id = seriesId;
      rows.push(row);
    }
    return rows;
  }

  // Wspólna logika przycisku "Usuń całą serię" — pyta o potwierdzenie
  // (z ostrzeżeniem, jeśli któreś z zajęć w serii są już oznaczone jako
  // odbyte, bo ich usunięcie wpłynie na wcześniejsze podsumowania zarobku),
  // a po potwierdzeniu usuwa wszystkie wiersze o tym samym series_id naraz.
  function confirmAndDeleteSeries(seriesId, allRowsInView, onDone) {
    var seriesRows = allRowsInView.filter(function (r) { return r.series_id === seriesId; });
    var completedCount = seriesRows.filter(function (r) { return r.status === 'completed'; }).length;
    var msg = 'Na pewno usunąć całą serię (' + seriesRows.length + ' zajęć)?';
    if (completedCount > 0) {
      msg += ' Uwaga: ' + completedCount + ' z nich jest oznaczonych jako odbyte — ich usunięcie wpłynie na wcześniejsze podsumowania zarobku.';
    }
    msg += ' Tej operacji nie można cofnąć.';
    if (!window.confirm(msg)) return;
    client.from('lesson_schedule').delete().eq('series_id', seriesId).then(function (res) {
      if (res.error) return;
      onDone();
    });
  }

  function deleteSeriesButtonHtml(r) {
    return r.series_id ? '<button type="button" class="btn btn-outline btn-xs" data-action="delete-series">Usuń całą serię</button>' : '';
  }

  // ---------- POMOCNICZE DO WIDOKU TYGODNIOWEGO ("Mój grafik zajęć") ----------

  var WEEKDAY_LABELS = ['Nd', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];

  function weekdayLabel(iso) {
    var parts = iso.split('-');
    var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    return WEEKDAY_LABELS[d.getUTCDay()];
  }

  function displayDateShort(iso) {
    var parts = iso.split('-');
    return parts[2] + '.' + parts[1];
  }

  function lessonChipHtml(r) {
    var color = r.status === 'cancelled' ? '#B3261E' : (r.status === 'completed' ? 'var(--color-accent-dark)' : 'var(--color-ink)');
    var timeText = r.lesson_time ? escapeHtml(r.lesson_time) + ' — ' : '';
    return '<div style="font-size:12.5px; line-height:1.5; color:' + color + ';">' + timeText + escapeHtml(r.student_name) + '</div>';
  }

  // ---------- POMOCNICZE DO "PODSUMOWANIA MIESIĄCA" (zarobek, liczba lekcji) ----------

  var MONTH_NAMES_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

  function monthStartFromDate(d) {
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = '0' + m;
    return d.getFullYear() + '-' + m + '-01';
  }

  function addMonthsToMonthStart(iso, delta) {
    var parts = iso.split('-');
    var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1 + delta, 1));
    var m = String(d.getUTCMonth() + 1);
    if (m.length < 2) m = '0' + m;
    return d.getUTCFullYear() + '-' + m + '-01';
  }

  function monthLabel(iso) {
    var parts = iso.split('-');
    return MONTH_NAMES_PL[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  // ---------- PRZEŁĄCZNIK LOGOWANIE / REJESTRACJA LEKTORA ----------

  var showingRegister = false;
  function setAuthMode(register) {
    showingRegister = register;
    loginForm.style.display = showingRegister ? 'none' : 'flex';
    registerForm.style.display = showingRegister ? 'flex' : 'none';
    loginForm.style.flexDirection = 'column';
    registerForm.style.flexDirection = 'column';
    authHeading.textContent = showingRegister ? 'Zarejestruj się jako lektor' : 'Zaloguj się';
    authSubtitle.textContent = showingRegister
      ? 'Po rejestracji Twoje konto czeka na zatwierdzenie przez administratora — zobaczysz status od razu po zalogowaniu.'
      : 'Panel administratora i lektorów.';
    authModeToggle.textContent = showingRegister ? 'Masz już konto? Zaloguj się' : 'Nie masz jeszcze konta? Zarejestruj się jako lektor';
  }
  authModeToggle.addEventListener('click', function () { setAuthMode(!showingRegister); });

  // ---------- LOGOWANIE / REJESTRACJA / WYLOGOWANIE ----------

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.style.display = 'none';
    var email = document.getElementById('admin-email').value.trim();
    var password = document.getElementById('admin-password').value;
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) {
        loginError.textContent = 'Nieprawidłowy e-mail lub hasło.';
        loginError.style.display = 'block';
        return;
      }
      routeAfterLogin(res.data.session);
    });
  });

  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    registerError.style.display = 'none';
    registerSuccess.style.display = 'none';
    var name = document.getElementById('register-name').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var password = document.getElementById('register-password').value;
    if (!name) { showMessage(registerError, 'Podaj imię i nazwisko.', 'error'); return; }

    client.auth.signUp({ email: email, password: password }).then(function (res) {
      if (res.error) {
        showMessage(registerError, 'Błąd rejestracji: ' + res.error.message, 'error');
        return;
      }
      var session = res.data && res.data.session;
      var user = res.data && res.data.user;
      if (session && user) {
        // e-mail nie wymaga potwierdzenia — konto od razu zalogowane
        ensureTutorProfile(user, name).then(function () { routeAfterLogin(session); });
      } else {
        // wymagane potwierdzenie e-maila — poprosimy o dane profilu przy pierwszym logowaniu
        window.__pendingTutorName = name;
        showMessage(registerSuccess, 'Konto utworzone! Sprawdź e-mail, żeby potwierdzić rejestrację, a potem zaloguj się tutaj.', 'success');
        registerForm.reset();
      }
    });
  });

  logoutBtn.addEventListener('click', function () {
    client.auth.signOut().then(function () { showLogin(); });
  });

  function showLogin() {
    dashboardSection.style.display = 'none';
    tutorDashboardSection.style.display = 'none';
    loginSection.style.display = 'block';
    logoutBtn.style.display = 'none';
    setAuthMode(false);
  }

  // ---------- ROUTING WEDŁUG ROLI ----------

  function isSessionAdmin(session) {
    return !!(session && session.user && session.user.app_metadata && session.user.app_metadata.role === 'admin');
  }

  function ensureTutorProfile(user, fallbackName) {
    return client.from('tutor_profiles').select('*').eq('user_id', user.id).then(function (res) {
      if (res.data && res.data.length) return res.data[0];
      var payload = {
        user_id: user.id,
        email: user.email || '',
        account_status: 'pending',
        pending_name: fallbackName || window.__pendingTutorName || ''
      };
      return client.from('tutor_profiles').insert(payload).select().then(function (insertRes) {
        return (insertRes.data && insertRes.data[0]) || payload;
      });
    });
  }

  function routeAfterLogin(session) {
    if (!session) { showLogin(); return; }
    loginSection.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';

    if (isSessionAdmin(session)) {
      currentAdminUserId = session.user.id;
      showAdminDashboard();
    } else {
      ensureTutorProfile(session.user).then(function (row) {
        showTutorDashboard(row);
      });
    }
  }

  function showAdminDashboard() {
    tutorDashboardSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    loadTodayLessons();
    loadMySchedule();
    loadHourlyRate();
    loadStudentRates();
    loadTutorsAdmin();
    loadScheduleAdmin();
    loadNavVisibility();
    loadPricingAdmin();
    loadTestimonialsAdmin();
    loadContactAdmin();
    loadFaqAdmin();
    loadWordsAdmin();
    loadQuotesAdmin();
    loadLettersAdmin();
    loadSiteContentAdmin();
    loadPhotoAdmin();
    loadVideosAdmin();
    loadWebinarsAdmin();
    loadDiagnosisAdmin();
  }

  client.auth.getSession().then(function (res) {
    routeAfterLogin(res.data && res.data.session);
  });

  // ==========================================================================
  // PANEL LEKTORA
  // ==========================================================================

  var tutorStatusBanner = document.getElementById('tutor-status-banner');
  var tutorProfileWrap = document.getElementById('tutor-profile-wrap');
  var tutorSubmissionStatus = document.getElementById('tutor-submission-status');
  var tutorProfileForm = document.getElementById('tutor-profile-form');
  var tutorPhotoInput = document.getElementById('tutor-photo-input');
  var tutorPhotoPreview = document.getElementById('tutor-photo-preview');
  var tutorPhotoMessage = document.getElementById('tutor-photo-message');

  function showTutorDashboard(row) {
    currentTutorRow = row;
    dashboardSection.style.display = 'none';
    tutorDashboardSection.style.display = 'block';

    if (row.account_status === 'pending') {
      tutorStatusBanner.style.display = 'block';
      tutorStatusBanner.textContent = 'Twoje konto oczekuje na zatwierdzenie przez administratora. Wróć tutaj, gdy tylko dostaniesz od niego informację — wtedy pojawi się formularz profilu i grafik zajęć.';
      tutorProfileWrap.style.display = 'none';
      return;
    }
    if (row.account_status === 'rejected') {
      tutorStatusBanner.style.display = 'block';
      tutorStatusBanner.textContent = 'Administrator odrzucił Twoje konto' + (row.rejection_reason ? (': ' + row.rejection_reason) : '.') + ' Skontaktuj się z administratorem, jeśli to pomyłka.';
      tutorProfileWrap.style.display = 'none';
      return;
    }

    // account_status === 'approved'
    tutorStatusBanner.style.display = 'none';
    tutorProfileWrap.style.display = 'block';

    document.getElementById('tutor-name').value = row.has_pending_submission ? row.pending_name : row.name;
    document.getElementById('tutor-bio').value = row.has_pending_submission ? row.pending_bio : row.bio;
    tutorPhotoPreview.src = (row.has_pending_submission && row.pending_photo_url) || row.photo_url || 'img/lektor-przyklad.svg';

    if (row.has_pending_submission) {
      tutorSubmissionStatus.innerHTML = '<span class="admin-message is-success" style="display:inline-block;">Zmiany oczekują na zatwierdzenie przez administratora.</span>';
    } else if (row.published) {
      tutorSubmissionStatus.innerHTML = '<span class="admin-message is-success" style="display:inline-block;">Twój profil jest zatwierdzony i widoczny publicznie na stronie „Nasz zespół”.</span>';
    } else if (row.name || row.bio) {
      tutorSubmissionStatus.innerHTML = '<span class="admin-message is-error" style="display:inline-block;">Ostatnie zgłoszenie zostało odrzucone' + (row.rejection_reason ? (': ' + escapeHtml(row.rejection_reason)) : '.') + ' Popraw dane i wyślij ponownie.</span>';
    } else {
      tutorSubmissionStatus.innerHTML = '<span class="text-muted" style="font-size:13px;">Nie wysłałeś jeszcze żadnych danych profilu.</span>';
    }

    loadTutorSchedule();
  }

  tutorProfileForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      pending_name: document.getElementById('tutor-name').value.trim(),
      pending_bio: document.getElementById('tutor-bio').value.trim(),
      has_pending_submission: true
    };
    client.from('tutor_profiles').update(payload).eq('user_id', currentTutorRow.user_id).then(function (res) {
      if (res.error) { showMessage(tutorSubmissionStatus, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
      Object.assign(currentTutorRow, payload);
      showTutorDashboard(currentTutorRow);
    });
  });

  tutorPhotoInput.addEventListener('change', function () {
    var file = tutorPhotoInput.files && tutorPhotoInput.files[0];
    if (!file || !currentTutorRow) return;
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var path = 'tutor-photos/' + currentTutorRow.user_id + '/photo-' + Date.now() + '.' + ext;

    showMessage(tutorPhotoMessage, 'Wgrywanie zdjęcia…', 'success');
    tutorPhotoMessage.style.display = 'block';

    client.storage.from('media').upload(path, file, { upsert: true }).then(function (uploadRes) {
      if (uploadRes.error) { showMessage(tutorPhotoMessage, 'Błąd wgrywania: ' + uploadRes.error.message, 'error'); return; }
      var publicUrlRes = client.storage.from('media').getPublicUrl(path);
      var publicUrl = publicUrlRes.data && publicUrlRes.data.publicUrl;
      if (!publicUrl) { showMessage(tutorPhotoMessage, 'Nie udało się pobrać adresu zdjęcia.', 'error'); return; }

      client.from('tutor_profiles').update({ pending_photo_url: publicUrl, has_pending_submission: true }).eq('user_id', currentTutorRow.user_id).then(function (updateRes) {
        if (updateRes.error) { showMessage(tutorPhotoMessage, 'Błąd zapisu zdjęcia: ' + updateRes.error.message, 'error'); return; }
        currentTutorRow.pending_photo_url = publicUrl;
        currentTutorRow.has_pending_submission = true;
        showMessage(tutorPhotoMessage, 'Zdjęcie wysłane do zatwierdzenia.', 'success');
        showTutorDashboard(currentTutorRow);
      });
    });
  });

  // ---------- GRAFIK ZAJĘĆ (WŁASNY, LEKTOR) ----------

  function loadTutorSchedule() {
    client
      .from('lesson_schedule')
      .select('*')
      .eq('tutor_id', currentTutorRow.user_id)
      .order('lesson_date', { ascending: true })
      .then(function (res) {
        if (res.error) return;
        renderTutorSchedule(res.data);
      });
  }

  function renderTutorSchedule(rows) {
    var container = document.querySelector('[data-tutor-schedule]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row" data-row-id="' + r.id + '"' + (r.series_id ? ' data-series-id="' + r.series_id + '"' : '') + '>' +
        '<span style="min-width:110px;">' + escapeHtml(r.lesson_date) + (r.lesson_time ? ' ' + escapeHtml(r.lesson_time) : '') + '</span>' +
        '<span class="text-muted" style="min-width:50px; font-size:12px;">' + (r.duration_minutes || 60) + ' min</span>' +
        '<span style="flex:1 1 140px;">' + escapeHtml(r.student_name) + '</span>' +
        '<span class="text-muted" style="flex:1 1 160px; font-size:13px;">' + escapeHtml(r.notes) + '</span>' +
        lessonStatusSelectHtml(r.status) +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-lesson">Usuń</button>' +
        deleteSeriesButtonHtml(r) +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zaplanowanych zajęć.</p>';

    container.querySelectorAll('[data-action="delete-lesson"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').delete().eq('id', id).then(function (res) {
          if (res.error) return;
          loadTutorSchedule();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-series"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var seriesId = btn.closest('.admin-row').getAttribute('data-series-id');
        confirmAndDeleteSeries(seriesId, rows, loadTutorSchedule);
      });
    });

    container.querySelectorAll('[data-action="set-status"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = Number(sel.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').update({ status: sel.value }).eq('id', id).then(function () {});
      });
    });
  }

  var addLessonBtn = document.querySelector('[data-action="add-lesson"]');
  if (addLessonBtn) {
    addLessonBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-lesson]');
      var payload = { tutor_id: currentTutorRow.user_id };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      payload.duration_minutes = Number(payload.duration_minutes) || 60;
      if (!payload.student_name || !payload.lesson_date) { return; }
      var repeatSelect = document.getElementById('lesson-repeat-select');
      var rows = buildRecurringLessonRows(payload, repeatSelect ? Number(repeatSelect.value) : 1);
      client.from('lesson_schedule').insert(rows).then(function (res) {
        if (res.error) return;
        inputs.forEach(function (input) {
          input.value = (input.getAttribute('data-field') === 'duration_minutes') ? '60' : '';
        });
        if (repeatSelect) repeatSelect.value = '1';
        loadTutorSchedule();
      });
    });
  }

  // ==========================================================================
  // PANEL ADMINA — ZARZĄDZANIE LEKTORAMI I GRAFIKIEM
  // ==========================================================================

  // ---------- DZISIEJSZE ZAJĘCIA (WIDGET, WSZYSCY LEKTORZY + ADMIN) ----------

  function loadTodayLessons() {
    Promise.all([
      client.from('lesson_schedule').select('*').eq('lesson_date', todayIso()).order('lesson_time', { ascending: true }),
      client.from('tutor_profiles').select('*')
    ]).then(function (results) {
      var scheduleRes = results[0];
      var tutorsRes = results[1];
      if (scheduleRes.error) return;
      var tutorsByUserId = {};
      (tutorsRes.data || []).forEach(function (t) { tutorsByUserId[t.user_id] = t; });
      renderTodayLessons(scheduleRes.data, tutorsByUserId);
    });
  }

  function lessonOwnerName(tutorId, tutorsByUserId) {
    if (tutorId === currentAdminUserId) return 'Ty (administrator)';
    var tutor = tutorsByUserId[tutorId];
    return tutor ? (tutor.name || tutor.pending_name || tutor.email) : tutorId;
  }

  function renderTodayLessons(rows, tutorsByUserId) {
    var container = document.querySelector('[data-admin-today]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row" data-row-id="' + r.id + '">' +
        '<span style="min-width:70px;">' + (escapeHtml(r.lesson_time) || '—') + '</span>' +
        '<strong style="min-width:130px;">' + escapeHtml(lessonOwnerName(r.tutor_id, tutorsByUserId)) + '</strong>' +
        '<span style="flex:1 1 140px;">' + escapeHtml(r.student_name) + '</span>' +
        lessonStatusSelectHtml(r.status) +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zajęć zaplanowanych na dziś.</p>';

    container.querySelectorAll('[data-action="set-status"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = Number(sel.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').update({ status: sel.value }).eq('id', id).then(function (res) {
          if (res.error) return;
          loadScheduleAdmin();
          loadMySchedule();
        });
      });
    });
  }

  // ---------- GRAFIK ZAJĘĆ (WŁASNY, ADMIN) ----------
  // Działa dokładnie tak samo jak "Twój grafik zajęć" w panelu lektora
  // (patrz sekcja "GRAFIK ZAJĘĆ (WŁASNY, LEKTOR)" wyżej) — ta sama tabela
  // lesson_schedule, tylko tutor_id = auth.uid() zalogowanego administratora.

  function loadMySchedule() {
    if (!currentAdminUserId) return;
    client
      .from('lesson_schedule')
      .select('*')
      .eq('tutor_id', currentAdminUserId)
      .order('lesson_date', { ascending: true })
      .then(function (res) {
        if (res.error) return;
        latestMyScheduleRows = res.data;
        renderMySchedule(res.data);
        renderMyScheduleWeek(res.data);
        renderMonthlySummary();
      });
  }

  // ---------- PODSUMOWANIE MIESIĄCA (liczba lekcji + szacowany zarobek) ----------
  // Stawka za godzinę to wartość ustawiona ręcznie przez administratora
  // (tabela admin_settings, sekcja "10" w supabase-setup.sql). Zarobek za
  // lekcję liczy się proporcjonalnie do jej długości: (czas w minutach / 60)
  // × stawka za godzinę. Do zarobku i liczby lekcji NIE wliczają się zajęcia
  // odwołane — tylko zaplanowane i odbyte.

  function loadHourlyRate() {
    client.from('admin_settings').select('*').eq('id', 1).single().then(function (res) {
      if (res.error || !res.data) return;
      currentHourlyRate = Number(res.data.hourly_rate) || 0;
      var input = document.getElementById('admin-hourly-rate');
      if (input) input.value = currentHourlyRate || '';
      renderMonthlySummary();
    });
  }

  function rateForStudent(studentName) {
    var key = (studentName || '').trim().toLowerCase();
    if (key && studentRatesMap.hasOwnProperty(key)) return studentRatesMap[key];
    return currentHourlyRate;
  }

  function renderMonthlySummary() {
    var labelEl = document.getElementById('summary-month-label');
    var countEl = document.getElementById('summary-lesson-count');
    var earningsEl = document.getElementById('summary-earnings');
    if (!labelEl || !countEl || !earningsEl) return;

    if (!summaryMonthStart) summaryMonthStart = monthStartFromDate(new Date());
    var monthKey = summaryMonthStart.slice(0, 7); // "RRRR-MM"

    var relevant = latestMyScheduleRows.filter(function (r) {
      return r.lesson_date && r.lesson_date.slice(0, 7) === monthKey && r.status !== 'cancelled';
    });
    var totalEarnings = relevant.reduce(function (sum, r) {
      var minutes = r.duration_minutes || 60;
      return sum + (minutes / 60) * rateForStudent(r.student_name);
    }, 0);

    labelEl.textContent = monthLabel(summaryMonthStart);
    countEl.textContent = String(relevant.length);
    earningsEl.textContent = totalEarnings.toFixed(2).replace('.', ',') + ' zł';
  }

  // ---------- STAWKI INDYWIDUALNE KURSANTÓW (student_rates) ----------

  function loadStudentRates() {
    client.from('student_rates').select('*').order('student_name', { ascending: true }).then(function (res) {
      if (res.error) return;
      studentRatesMap = {};
      (res.data || []).forEach(function (r) {
        var key = (r.student_name || '').trim().toLowerCase();
        if (key) studentRatesMap[key] = Number(r.hourly_rate) || 0;
      });
      renderStudentRatesAdmin(res.data || []);
      renderMonthlySummary();
      renderMySchedule(latestMyScheduleRows);
    });
  }

  function renderStudentRatesAdmin(rows) {
    var container = document.querySelector('[data-admin-student-rates]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + r.id + '">' +
        '<input type="text" value="' + escapeHtml(r.student_name) + '" data-field="student_name" placeholder="Imię i nazwisko kursanta">' +
        '<input type="number" value="' + escapeHtml(r.hourly_rate) + '" data-field="hourly_rate" min="0" step="0.01" placeholder="Stawka za godzinę (zł)">' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-student-rate">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-student-rate">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak stawek indywidualnych — dla wszystkich kursantów liczy się stawka ogólna.</p>';

    container.querySelectorAll('[data-action="save-student-rate"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          student_name: row.querySelector('[data-field="student_name"]').value.trim(),
          hourly_rate: Number(row.querySelector('[data-field="hourly_rate"]').value) || 0
        };
        if (!payload.student_name) { showMessage(globalMessage, 'Podaj imię i nazwisko kursanta.', 'error'); return; }
        client.from('student_rates').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano stawkę.', 'success');
          loadStudentRates();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-student-rate"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('student_rates').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto stawkę indywidualną.', 'success');
          loadStudentRates();
        });
      });
    });
  }

  var addStudentRateBtn = document.querySelector('[data-action="add-student-rate"]');
  if (addStudentRateBtn) {
    addStudentRateBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-student-rate]');
      var payload = {};
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      payload.hourly_rate = Number(payload.hourly_rate) || 0;
      if (!payload.student_name) { showMessage(globalMessage, 'Podaj imię i nazwisko kursanta.', 'error'); return; }
      client.from('student_rates').insert(payload).then(function (res) {
        if (res.error) {
          var msg = res.error.message && res.error.message.indexOf('duplicate') !== -1
            ? 'Ten kursant ma już ustawioną stawkę indywidualną — zmień ją na liście powyżej zamiast dodawać drugi raz.'
            : 'Błąd dodawania: ' + res.error.message;
          showMessage(globalMessage, msg, 'error');
          return;
        }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano stawkę indywidualną.', 'success');
        loadStudentRates();
      });
    });
  }

  var summaryPrevBtn = document.getElementById('summary-month-prev');
  var summaryNextBtn = document.getElementById('summary-month-next');
  if (summaryPrevBtn) {
    summaryPrevBtn.addEventListener('click', function () {
      if (!summaryMonthStart) summaryMonthStart = monthStartFromDate(new Date());
      summaryMonthStart = addMonthsToMonthStart(summaryMonthStart, -1);
      renderMonthlySummary();
    });
  }
  if (summaryNextBtn) {
    summaryNextBtn.addEventListener('click', function () {
      if (!summaryMonthStart) summaryMonthStart = monthStartFromDate(new Date());
      summaryMonthStart = addMonthsToMonthStart(summaryMonthStart, 1);
      renderMonthlySummary();
    });
  }

  var hourlyRateForm = document.getElementById('admin-hourly-rate-form');
  if (hourlyRateForm) {
    hourlyRateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = Number(document.getElementById('admin-hourly-rate').value) || 0;
      client.from('admin_settings').upsert({ id: 1, hourly_rate: val }).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd zapisu stawki: ' + res.error.message, 'error'); return; }
        currentHourlyRate = val;
        showMessage(globalMessage, 'Zapisano stawkę godzinową.', 'success');
        renderMonthlySummary();
      });
    });
  }

  // Tabela "Podgląd — najbliższe 7 dni" nad pełną listą — czysty podgląd
  // (te same dane co lista niżej, tylko ułożone dzień po dniu). Przycisk
  // "+ Dodaj" pod każdym dniem nie dodaje nic sam z siebie — tylko ustawia
  // datę w istniejącym formularzu poniżej i przenosi tam kursor, żeby nie
  // trzeba było budować drugiego, osobnego mechanizmu zapisu.
  function renderMyScheduleWeek(rows) {
    var container = document.querySelector('[data-my-schedule-week]');
    if (!container) return;

    var start = todayIso();
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDaysToIsoDate(start, i));

    var byDay = {};
    days.forEach(function (d) { byDay[d] = []; });
    rows.forEach(function (r) {
      if (byDay.hasOwnProperty(r.lesson_date)) byDay[r.lesson_date].push(r);
    });
    days.forEach(function (d) {
      byDay[d].sort(function (a, b) { return (a.lesson_time || '').localeCompare(b.lesson_time || ''); });
    });

    var headerHtml = days.map(function (d) {
      var todayStyle = d === start ? ' style="background:var(--color-accent-soft-bg);"' : '';
      return '<th' + todayStyle + '>' + weekdayLabel(d) + '<br>' + displayDateShort(d) + '</th>';
    }).join('');

    var cellsHtml = days.map(function (d) {
      var todayStyle = d === start ? ' style="background:var(--color-accent-soft-bg); vertical-align:top;"' : '';
      var lessons = byDay[d];
      var lessonsHtml = lessons.length
        ? lessons.map(function (r) { return lessonChipHtml(r); }).join('')
        : '<span class="text-muted" style="font-size:12px;">—</span>';
      return (
        '<td' + todayStyle + '>' +
        lessonsHtml +
        '<button type="button" class="btn btn-outline btn-xs" style="margin-top:8px;" data-action="week-add" data-date="' + d + '">+ Dodaj</button>' +
        '</td>'
      );
    }).join('');

    container.innerHTML =
      '<div class="week-table-scroll"><table class="price-table week-table">' +
      '<thead><tr>' + headerHtml + '</tr></thead>' +
      '<tbody><tr>' + cellsHtml + '</tr></tbody>' +
      '</table></div>';

    container.querySelectorAll('[data-action="week-add"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var iso = btn.getAttribute('data-date');
        var dateInput = document.querySelector('[data-new-my-lesson][data-field="lesson_date"]');
        var nameInput = document.querySelector('[data-new-my-lesson][data-field="student_name"]');
        if (dateInput) dateInput.value = iso;
        if (nameInput) {
          nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nameInput.focus();
        }
      });
    });
  }

  function renderMySchedule(rows) {
    var container = document.querySelector('[data-my-schedule]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      var rateKey = (r.student_name || '').trim().toLowerCase();
      var rateBadge = (rateKey && studentRatesMap.hasOwnProperty(rateKey))
        ? ' <span class="badge badge-tint" style="padding:1px 8px; font-size:10.5px;" title="Stawka indywidualna">' + studentRatesMap[rateKey].toFixed(0) + ' zł/h</span>'
        : '';
      return (
        '<div class="admin-row" data-row-id="' + r.id + '"' + (r.series_id ? ' data-series-id="' + r.series_id + '"' : '') + '>' +
        '<span style="min-width:110px;">' + escapeHtml(r.lesson_date) + (r.lesson_time ? ' ' + escapeHtml(r.lesson_time) : '') + '</span>' +
        '<span class="text-muted" style="min-width:50px; font-size:12px;">' + (r.duration_minutes || 60) + ' min</span>' +
        '<span style="flex:1 1 140px;">' + escapeHtml(r.student_name) + rateBadge + '</span>' +
        '<span class="text-muted" style="flex:1 1 160px; font-size:13px;">' + escapeHtml(r.notes) + '</span>' +
        lessonStatusSelectHtml(r.status) +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-my-lesson">Usuń</button>' +
        deleteSeriesButtonHtml(r) +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zaplanowanych zajęć.</p>';

    container.querySelectorAll('[data-action="delete-my-lesson"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').delete().eq('id', id).then(function (res) {
          if (res.error) return;
          loadMySchedule();
          loadTodayLessons();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-series"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var seriesId = btn.closest('.admin-row').getAttribute('data-series-id');
        confirmAndDeleteSeries(seriesId, rows, function () {
          loadMySchedule();
          loadTodayLessons();
        });
      });
    });

    container.querySelectorAll('[data-action="set-status"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = Number(sel.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').update({ status: sel.value }).eq('id', id).then(function (res) {
          if (res.error) return;
          loadTodayLessons();
          loadMySchedule();
        });
      });
    });
  }

  var addMyLessonBtn = document.querySelector('[data-action="add-my-lesson"]');
  if (addMyLessonBtn) {
    addMyLessonBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-my-lesson]');
      var payload = { tutor_id: currentAdminUserId };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      payload.duration_minutes = Number(payload.duration_minutes) || 60;
      if (!payload.student_name || !payload.lesson_date) { return; }
      var repeatSelect = document.getElementById('my-lesson-repeat-select');
      var rows = buildRecurringLessonRows(payload, repeatSelect ? Number(repeatSelect.value) : 1);
      client.from('lesson_schedule').insert(rows).then(function (res) {
        if (res.error) return;
        inputs.forEach(function (input) {
          input.value = (input.getAttribute('data-field') === 'duration_minutes') ? '60' : '';
        });
        if (repeatSelect) repeatSelect.value = '1';
        loadMySchedule();
        loadTodayLessons();
      });
    });
  }

  function loadTutorsAdmin() {
    client
      .from('tutor_profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania lektorów: ' + res.error.message, 'error');
          return;
        }
        renderTutorsAdmin(res.data);
      });
  }

  function tutorStatusBadge(row) {
    if (!row.user_id) return '<span class="badge badge-outline">Bez konta (dodany ręcznie)</span>';
    if (row.account_status === 'pending') return '<span class="badge badge-outline">Konto: oczekuje</span>';
    if (row.account_status === 'rejected') return '<span class="badge badge-outline">Konto: odrzucone</span>';
    return '<span class="badge badge-outline">Konto: zatwierdzone</span>';
  }

  function renderTutorsAdmin(rows) {
    var container = document.querySelector('[data-admin-tutors]');
    if (!container) return;
    latestTutorRows = rows;
    container.innerHTML = rows.map(function (t) {
      var displayName = t.name || t.pending_name || '(bez nazwy)';
      var isManual = !t.user_id;
      var actions = '';
      if (t.account_status === 'pending') {
        actions += '<button type="button" class="btn btn-outline btn-xs" data-action="approve-account">Zatwierdź konto</button>';
        actions += '<button type="button" class="btn btn-danger btn-xs" data-action="reject-account">Odrzuć konto</button>';
      }
      if (t.has_pending_submission) {
        actions += '<button type="button" class="btn btn-outline btn-xs" data-action="approve-submission">Zatwierdź zmiany profilu</button>';
        actions += '<button type="button" class="btn btn-danger btn-xs" data-action="reject-submission">Odrzuć zmiany</button>';
      }
      if (t.account_status === 'approved') {
        actions += '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (t.published ? ' checked' : '') + '> opublikowany</label>';
      }
      if (isManual) {
        actions += '<button type="button" class="btn btn-outline btn-xs" data-action="edit-manual-tutor">Edytuj</button>';
      }
      actions += '<button type="button" class="btn btn-danger btn-xs" data-action="delete-tutor">' + (isManual ? 'Usuń wizytówkę' : 'Usuń konto') + '</button>';

      var pendingPreview = t.has_pending_submission
        ? '<div class="text-muted" style="font-size:13px; margin-top:6px;">Zgłoszone dane: <strong>' + escapeHtml(t.pending_name || '—') + '</strong> — ' + escapeHtml((t.pending_bio || '').slice(0, 140)) + (t.pending_photo_url ? ' · zdjęcie dołączone' : '') + '</div>'
        : '';

      return (
        '<div class="admin-row-testimonial" data-row-id="' + t.id + '" data-user-id="' + escapeHtml(t.user_id) + '" style="flex-direction:column; align-items:stretch;">' +
        '<div class="row-wrap gap-sm" style="align-items:center;">' +
        '<strong>' + escapeHtml(displayName) + '</strong>' +
        (t.email ? '<span class="text-muted" style="font-size:13px;">' + escapeHtml(t.email) + '</span>' : '') +
        tutorStatusBadge(t) +
        '</div>' +
        pendingPreview +
        '<div class="row-wrap gap-sm" style="margin-top:8px;">' + actions + '</div>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zarejestrowanych lektorów.</p>';

    container.querySelectorAll('[data-action="approve-account"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateTutor(btn, { account_status: 'approved', rejection_reason: '' });
      });
    });
    container.querySelectorAll('[data-action="reject-account"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var reason = window.prompt('Powód odrzucenia konta (opcjonalnie):', '') || '';
        updateTutor(btn, { account_status: 'rejected', rejection_reason: reason });
      });
    });
    container.querySelectorAll('[data-action="approve-submission"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = findTutorRow(btn);
        updateTutor(btn, {
          name: row.pending_name,
          bio: row.pending_bio,
          photo_url: row.pending_photo_url || row.photo_url,
          has_pending_submission: false,
          published: true,
          rejection_reason: ''
        });
      });
    });
    container.querySelectorAll('[data-action="reject-submission"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var reason = window.prompt('Powód odrzucenia zgłoszonych zmian (opcjonalnie):', '') || '';
        updateTutor(btn, { has_pending_submission: false, rejection_reason: reason });
      });
    });
    container.querySelectorAll('[data-field="published"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        updateTutor(checkbox, { published: checkbox.checked });
      });
    });
    container.querySelectorAll('[data-action="edit-manual-tutor"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startEditManualTutor(findTutorRow(btn));
      });
    });
    container.querySelectorAll('[data-action="delete-tutor"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('tutor_profiles').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto konto lektora.', 'success');
          loadTutorsAdmin();
        });
      });
    });
  }

  var latestTutorRows = [];
  function findTutorRow(el) {
    var row = el.closest('.admin-row-testimonial');
    var id = Number(row.getAttribute('data-row-id'));
    return latestTutorRows.filter(function (r) { return r.id === id; })[0] || {};
  }

  function updateTutor(el, payload) {
    var row = el.closest('.admin-row-testimonial');
    var id = Number(row.getAttribute('data-row-id'));
    client.from('tutor_profiles').update(payload).eq('id', id).then(function (res) {
      if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
      showMessage(globalMessage, 'Zapisano zmianę.', 'success');
      loadTutorsAdmin();
    });
  }

  // ---------- LEKTORZY: DODAWANIE RĘCZNE (BEZ KONTA) ----------

  var manualTutorForm = document.getElementById('manual-tutor-form');
  var manualTutorNameInput = document.getElementById('manual-tutor-name');
  var manualTutorBioInput = document.getElementById('manual-tutor-bio');
  var manualTutorPublishedInput = document.getElementById('manual-tutor-published');
  var manualTutorPhotoInput = document.getElementById('manual-tutor-photo-input');
  var manualTutorPhotoPreview = document.getElementById('manual-tutor-photo-preview');
  var manualTutorPhotoMessage = document.getElementById('manual-tutor-photo-message');
  var manualTutorSubmitBtn = document.getElementById('manual-tutor-submit');
  var manualTutorCancelBtn = document.getElementById('manual-tutor-cancel');
  var manualTutorEditId = null;
  var manualTutorPhotoUrl = '';

  function resetManualTutorForm() {
    manualTutorEditId = null;
    manualTutorPhotoUrl = '';
    if (manualTutorForm) manualTutorForm.reset();
    if (manualTutorPhotoPreview) manualTutorPhotoPreview.src = 'img/lektor-przyklad.svg';
    if (manualTutorPhotoMessage) manualTutorPhotoMessage.style.display = 'none';
    if (manualTutorSubmitBtn) manualTutorSubmitBtn.textContent = 'Dodaj lektora';
    if (manualTutorCancelBtn) manualTutorCancelBtn.style.display = 'none';
  }

  function startEditManualTutor(row) {
    if (!row) return;
    manualTutorEditId = row.id;
    manualTutorPhotoUrl = row.photo_url || '';
    if (manualTutorNameInput) manualTutorNameInput.value = row.name || '';
    if (manualTutorBioInput) manualTutorBioInput.value = row.bio || '';
    if (manualTutorPublishedInput) manualTutorPublishedInput.checked = !!row.published;
    if (manualTutorPhotoPreview) manualTutorPhotoPreview.src = row.photo_url || 'img/lektor-przyklad.svg';
    if (manualTutorSubmitBtn) manualTutorSubmitBtn.textContent = 'Zapisz zmiany';
    if (manualTutorCancelBtn) manualTutorCancelBtn.style.display = 'inline-flex';
    if (manualTutorForm) manualTutorForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (manualTutorNameInput) manualTutorNameInput.focus();
  }

  if (manualTutorCancelBtn) {
    manualTutorCancelBtn.addEventListener('click', function () {
      resetManualTutorForm();
    });
  }

  if (manualTutorPhotoInput) {
    manualTutorPhotoInput.addEventListener('change', function () {
      var file = manualTutorPhotoInput.files && manualTutorPhotoInput.files[0];
      if (!file) return;
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = 'tutor-photos/manual/photo-' + Date.now() + '.' + ext;
      showMessage(manualTutorPhotoMessage, 'Wgrywanie zdjęcia…', 'success');
      manualTutorPhotoMessage.style.display = 'block';
      client.storage.from('media').upload(path, file, { upsert: true }).then(function (uploadRes) {
        if (uploadRes.error) { showMessage(manualTutorPhotoMessage, 'Błąd wgrywania: ' + uploadRes.error.message, 'error'); return; }
        var publicUrlRes = client.storage.from('media').getPublicUrl(path);
        var publicUrl = publicUrlRes.data && publicUrlRes.data.publicUrl;
        if (!publicUrl) { showMessage(manualTutorPhotoMessage, 'Nie udało się pobrać adresu zdjęcia.', 'error'); return; }
        manualTutorPhotoUrl = publicUrl;
        if (manualTutorPhotoPreview) manualTutorPhotoPreview.src = publicUrl;
        showMessage(manualTutorPhotoMessage, 'Zdjęcie gotowe — zapisze się razem z formularzem.', 'success');
      });
    });
  }

  if (manualTutorForm) {
    manualTutorForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = manualTutorNameInput.value.trim();
      if (!name) { showMessage(globalMessage, 'Podaj imię i nazwisko lektora.', 'error'); return; }
      var payload = {
        name: name,
        bio: manualTutorBioInput.value.trim(),
        photo_url: manualTutorPhotoUrl || '',
        published: !!(manualTutorPublishedInput && manualTutorPublishedInput.checked)
      };
      if (manualTutorEditId) {
        client.from('tutor_profiles').update(payload).eq('id', manualTutorEditId).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano zmiany profilu.', 'success');
          resetManualTutorForm();
          loadTutorsAdmin();
        });
      } else {
        payload.user_id = null;
        payload.email = '';
        payload.account_status = 'approved';
        client.from('tutor_profiles').insert(payload).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Dodano lektora.', 'success');
          resetManualTutorForm();
          loadTutorsAdmin();
        });
      }
    });
  }

  // ---------- GRAFIK ZAJĘĆ (WSZYSCY LEKTORZY, ADMIN) ----------

  function loadScheduleAdmin() {
    Promise.all([
      client.from('lesson_schedule').select('*').order('lesson_date', { ascending: true }),
      client.from('tutor_profiles').select('*')
    ]).then(function (results) {
      var scheduleRes = results[0];
      var tutorsRes = results[1];
      if (scheduleRes.error) {
        showMessage(globalMessage, 'Błąd wczytywania grafiku: ' + scheduleRes.error.message, 'error');
        return;
      }
      var tutorsByUserId = {};
      (tutorsRes.data || []).forEach(function (t) { tutorsByUserId[t.user_id] = t; });
      renderScheduleAdmin(scheduleRes.data, tutorsByUserId);
    });
  }

  function renderScheduleAdmin(rows, tutorsByUserId) {
    var container = document.querySelector('[data-admin-schedule]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row" data-row-id="' + r.id + '"' + (r.series_id ? ' data-series-id="' + r.series_id + '"' : '') + '>' +
        '<strong style="min-width:130px;">' + escapeHtml(lessonOwnerName(r.tutor_id, tutorsByUserId)) + '</strong>' +
        '<span style="min-width:110px;">' + escapeHtml(r.lesson_date) + (r.lesson_time ? ' ' + escapeHtml(r.lesson_time) : '') + '</span>' +
        '<span class="text-muted" style="min-width:50px; font-size:12px;">' + (r.duration_minutes || 60) + ' min</span>' +
        '<span style="flex:1 1 120px;">' + escapeHtml(r.student_name) + '</span>' +
        '<span class="text-muted" style="flex:1 1 160px; font-size:13px;">' + escapeHtml(r.notes) + '</span>' +
        lessonStatusSelectHtml(r.status) +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-schedule-entry">Usuń</button>' +
        deleteSeriesButtonHtml(r) +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak wpisów w grafiku.</p>';

    container.querySelectorAll('[data-action="delete-schedule-entry"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto wpis z grafiku.', 'success');
          loadScheduleAdmin();
          loadTodayLessons();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-series"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var seriesId = btn.closest('.admin-row').getAttribute('data-series-id');
        confirmAndDeleteSeries(seriesId, rows, function () {
          showMessage(globalMessage, 'Usunięto całą serię zajęć.', 'success');
          loadScheduleAdmin();
          loadTodayLessons();
          loadMySchedule();
        });
      });
    });

    container.querySelectorAll('[data-action="set-status"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = Number(sel.closest('.admin-row').getAttribute('data-row-id'));
        client.from('lesson_schedule').update({ status: sel.value }).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu statusu: ' + res.error.message, 'error'); return; }
          loadTodayLessons();
          loadMySchedule();
        });
      });
    });
  }

  // ---------- WIDOCZNOŚĆ ZAKŁADEK (nav_visibility) ----------

  function loadNavVisibility() {
    client
      .from('nav_visibility')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania zakładek: ' + res.error.message, 'error'); return; }
        renderNavVisibility(res.data || []);
      });
  }

  function renderNavVisibility(rows) {
    var container = document.querySelector('[data-admin-nav-visibility]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<label class="admin-checkbox" data-row-id="' + escapeHtml(r.page_key) + '" style="display:flex; justify-content:space-between; align-items:center; white-space:normal; padding:10px 0; border-bottom:1px solid var(--color-border);">' +
        '<span style="color:var(--color-ink); font-size:14.5px;">' + escapeHtml(r.label || r.page_key) + '</span>' +
        '<input type="checkbox" data-field="visible"' + (r.visible ? ' checked' : '') + '>' +
        '</label>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zdefiniowanych zakładek.</p>';

    container.querySelectorAll('[data-field="visible"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var key = checkbox.closest('[data-row-id]').getAttribute('data-row-id');
        var willBeVisible = checkbox.checked;
        client.from('nav_visibility').update({ visible: willBeVisible }).eq('page_key', key).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); checkbox.checked = !willBeVisible; return; }
          showMessage(globalMessage, willBeVisible ? 'Zakładka włączona — wróci do menu i na stronę.' : 'Zakładka wyłączona — zniknie z menu i strona pokaże komunikat „niedostępna".', 'success');
        });
      });
    });
  }

  // ---------- CENNIK ----------

  function loadPricingAdmin() {
    client
      .from('pricing_packages')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania cennika: ' + res.error.message, 'error');
          return;
        }
        renderPricingTable('individual', res.data.filter(function (r) { return r.category === 'individual'; }));
        renderPricingTable('group', res.data.filter(function (r) { return r.category === 'group'; }));
      });
  }

  function renderPricingTable(category, rows) {
    var container = document.querySelector('[data-admin-pricing="' + category + '"]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row" data-row-id="' + r.id + '">' +
        '<input type="text" value="' + escapeHtml(r.name) + '" data-field="name">' +
        '<input type="text" value="' + escapeHtml(r.detail) + '" data-field="detail">' +
        '<input type="text" value="' + escapeHtml(r.price) + '" data-field="price">' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-pricing">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-pricing">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak pakietów w tej kategorii.</p>';

    container.querySelectorAll('[data-action="save-pricing"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          name: row.querySelector('[data-field="name"]').value.trim(),
          detail: row.querySelector('[data-field="detail"]').value.trim(),
          price: row.querySelector('[data-field="price"]').value.trim()
        };
        client.from('pricing_packages').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano pakiet cenowy.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-pricing"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('pricing_packages').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto pakiet cenowy.', 'success');
          loadPricingAdmin();
        });
      });
    });
  }

  document.querySelectorAll('[data-action="add-pricing"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var category = btn.getAttribute('data-category');
      var inputs = document.querySelectorAll('[data-new-pricing="' + category + '"]');
      var payload = { category: category, sort_order: 999 };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.name) { showMessage(globalMessage, 'Podaj przynajmniej nazwę pakietu.', 'error'); return; }
      client.from('pricing_packages').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nowy pakiet cenowy.', 'success');
        loadPricingAdmin();
      });
    });
  });

  // ---------- OPINIE ----------

  function loadTestimonialsAdmin() {
    client
      .from('testimonials')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania opinii: ' + res.error.message, 'error');
          return;
        }
        renderTestimonials(res.data);
      });
  }

  function renderTestimonials(rows) {
    var container = document.querySelector('[data-admin-testimonials]');
    if (!container) return;
    container.innerHTML = rows.map(function (t) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + t.id + '">' +
        '<textarea data-field="quote">' + escapeHtml(t.quote) + '</textarea>' +
        '<input type="text" value="' + escapeHtml(t.name) + '" data-field="name">' +
        '<input type="text" value="' + escapeHtml(t.role) + '" data-field="role">' +
        '<input type="text" value="' + escapeHtml(t.initials) + '" data-field="initials" style="max-width:90px;">' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (t.published ? ' checked' : '') + '> opublikowana</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-testimonial">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-testimonial">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych opinii.</p>';

    container.querySelectorAll('[data-action="save-testimonial"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          quote: row.querySelector('[data-field="quote"]').value.trim(),
          name: row.querySelector('[data-field="name"]').value.trim(),
          role: row.querySelector('[data-field="role"]').value.trim(),
          initials: row.querySelector('[data-field="initials"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('testimonials').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano opinię.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-testimonial"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('testimonials').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto opinię.', 'success');
          loadTestimonialsAdmin();
        });
      });
    });
  }

  var addTestimonialBtn = document.querySelector('[data-action="add-testimonial"]');
  if (addTestimonialBtn) {
    addTestimonialBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-testimonial]');
      var payload = { sort_order: 999, published: true };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.quote || !payload.name) { showMessage(globalMessage, 'Podaj przynajmniej treść opinii i imię.', 'error'); return; }
      client.from('testimonials').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nową opinię.', 'success');
        loadTestimonialsAdmin();
      });
    });
  }

  // ---------- DANE KONTAKTOWE ----------

  function loadContactAdmin() {
    client.from('contact_info').select('*').eq('id', 1).single().then(function (res) {
      if (res.error || !res.data) return;
      document.getElementById('admin-contact-email').value = res.data.email || '';
      document.getElementById('admin-contact-phone').value = res.data.phone || '';
      document.getElementById('admin-contact-location').value = res.data.location || '';
    });
  }

  var contactForm = document.getElementById('admin-contact-form');
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      id: 1,
      email: document.getElementById('admin-contact-email').value.trim(),
      phone: document.getElementById('admin-contact-phone').value.trim(),
      location: document.getElementById('admin-contact-location').value.trim()
    };
    client.from('contact_info').upsert(payload).then(function (res) {
      if (res.error) { showMessage(globalMessage, 'Błąd zapisu danych kontaktowych: ' + res.error.message, 'error'); return; }
      showMessage(globalMessage, 'Zapisano dane kontaktowe.', 'success');
    });
  });

  // ---------- FAQ ----------

  function loadFaqAdmin() {
    client
      .from('faq_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania FAQ: ' + res.error.message, 'error');
          return;
        }
        renderFaq(res.data);
      });
  }

  function renderFaq(rows) {
    var container = document.querySelector('[data-admin-faq]');
    if (!container) return;
    container.innerHTML = rows.map(function (f) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + f.id + '">' +
        '<input type="text" value="' + escapeHtml(f.question) + '" data-field="question">' +
        '<textarea data-field="answer">' + escapeHtml(f.answer) + '</textarea>' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (f.published ? ' checked' : '') + '> opublikowane</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-faq">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-faq">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych pytań.</p>';

    container.querySelectorAll('[data-action="save-faq"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          question: row.querySelector('[data-field="question"]').value.trim(),
          answer: row.querySelector('[data-field="answer"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('faq_items').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano pytanie.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-faq"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('faq_items').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto pytanie.', 'success');
          loadFaqAdmin();
        });
      });
    });
  }

  var addFaqBtn = document.querySelector('[data-action="add-faq"]');
  if (addFaqBtn) {
    addFaqBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-faq]');
      var payload = { sort_order: 999, published: true };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.question || !payload.answer) { showMessage(globalMessage, 'Podaj treść pytania i odpowiedzi.', 'error'); return; }
      client.from('faq_items').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nowe pytanie.', 'success');
        loadFaqAdmin();
      });
    });
  }

  // ---------- SŁOWO NA DZIŚ ----------

  function loadWordsAdmin() {
    client
      .from('words_of_day')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania słówek: ' + res.error.message, 'error'); return; }
        renderWordsAdmin(res.data);
      });
  }

  function renderWordsAdmin(rows) {
    var container = document.querySelector('[data-admin-words]');
    if (!container) return;
    container.innerHTML = rows.map(function (w) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + w.id + '">' +
        '<input type="text" value="' + escapeHtml(w.word) + '" data-field="word" placeholder="Słówko">' +
        '<input type="text" value="' + escapeHtml(w.part_of_speech) + '" data-field="part_of_speech" placeholder="Część mowy">' +
        '<input type="text" value="' + escapeHtml(w.pronunciation) + '" data-field="pronunciation" placeholder="Wymowa">' +
        '<input type="text" value="' + escapeHtml(w.dialect_label) + '" data-field="dialect_label" placeholder="Etykieta">' +
        '<textarea data-field="definition" placeholder="Wyjaśnienie">' + escapeHtml(w.definition) + '</textarea>' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (w.published ? ' checked' : '') + '> opublikowane</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-word">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-word">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych słówek.</p>';

    container.querySelectorAll('[data-action="save-word"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          word: row.querySelector('[data-field="word"]').value.trim(),
          part_of_speech: row.querySelector('[data-field="part_of_speech"]').value.trim(),
          pronunciation: row.querySelector('[data-field="pronunciation"]').value.trim(),
          dialect_label: row.querySelector('[data-field="dialect_label"]').value.trim(),
          definition: row.querySelector('[data-field="definition"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('words_of_day').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano słówko.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-word"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('words_of_day').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto słówko.', 'success');
          loadWordsAdmin();
        });
      });
    });
  }

  var addWordBtn = document.querySelector('[data-action="add-word"]');
  if (addWordBtn) {
    addWordBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-word]');
      var payload = { sort_order: 999, published: true };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.word || !payload.definition) { showMessage(globalMessage, 'Podaj przynajmniej słówko i wyjaśnienie.', 'error'); return; }
      client.from('words_of_day').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nowe słówko.', 'success');
        loadWordsAdmin();
      });
    });
  }

  // ---------- CYTATY MOTYWUJĄCE (motivational_quotes) ----------

  function loadQuotesAdmin() {
    client
      .from('motivational_quotes')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania cytatów: ' + res.error.message, 'error'); return; }
        renderQuotesAdmin(res.data);
      });
  }

  function renderQuotesAdmin(rows) {
    var container = document.querySelector('[data-admin-quotes]');
    if (!container) return;
    container.innerHTML = rows.map(function (q) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + q.id + '">' +
        '<textarea data-field="quote_text" placeholder="Treść cytatu">' + escapeHtml(q.quote_text) + '</textarea>' +
        '<input type="text" value="' + escapeHtml(q.author) + '" data-field="author" placeholder="Autor">' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (q.published ? ' checked' : '') + '> opublikowane</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-quote">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-quote">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych cytatów.</p>';

    container.querySelectorAll('[data-action="save-quote"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          quote_text: row.querySelector('[data-field="quote_text"]').value.trim(),
          author: row.querySelector('[data-field="author"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('motivational_quotes').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano cytat.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-quote"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('motivational_quotes').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto cytat.', 'success');
          loadQuotesAdmin();
        });
      });
    });
  }

  var addQuoteBtn = document.querySelector('[data-action="add-quote"]');
  if (addQuoteBtn) {
    addQuoteBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-quote]');
      var payload = { sort_order: 999, published: true };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.quote_text || !payload.author) { showMessage(globalMessage, 'Podaj treść cytatu i autora.', 'error'); return; }
      client.from('motivational_quotes').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nowy cytat.', 'success');
        loadQuotesAdmin();
      });
    });
  }

  // ---------- GRA NA ROZGRZEWKĘ — literki dnia (letter_game_days) ----------

  function loadLettersAdmin() {
    client
      .from('letter_game_days')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania liter: ' + res.error.message, 'error'); return; }
        renderLettersAdmin(res.data);
      });
  }

  function renderLettersAdmin(rows) {
    var container = document.querySelector('[data-admin-letters]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + r.id + '">' +
        '<input type="text" value="' + escapeHtml(r.letters) + '" data-field="letters" placeholder="Litery (np. TEACHERS)" style="text-transform:uppercase;">' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (r.published ? ' checked' : '') + '> opublikowane</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-letters">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-letters">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych zestawów liter.</p>';

    container.querySelectorAll('[data-action="save-letters"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          letters: row.querySelector('[data-field="letters"]').value.trim().toUpperCase(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('letter_game_days').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano litery.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-letters"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('letter_game_days').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto litery.', 'success');
          loadLettersAdmin();
        });
      });
    });
  }

  var addLettersBtn = document.querySelector('[data-action="add-letters"]');
  if (addLettersBtn) {
    addLettersBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-letters]');
      var payload = { sort_order: 999, published: true };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim().toUpperCase(); });
      if (!payload.letters) { showMessage(globalMessage, 'Podaj litery.', 'error'); return; }
      client.from('letter_game_days').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nowy zestaw liter.', 'success');
        loadLettersAdmin();
      });
    });
  }

  // ---------- TREŚCI STRON (site_content) ----------

  function loadSiteContentAdmin() {
    client
      .from('site_content')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania treści: ' + res.error.message, 'error');
          return;
        }
        renderSiteContent(res.data.filter(function (r) { return r.key !== 'lektor_photo_url'; }));
      });
  }

  function renderSiteContent(rows) {
    var container = document.querySelector('[data-admin-content]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      var field = r.input_type === 'textarea'
        ? '<textarea data-field="value" rows="3">' + escapeHtml(r.value) + '</textarea>'
        : '<input type="text" value="' + escapeHtml(r.value) + '" data-field="value">';
      return (
        '<div class="admin-content-row" data-row-id="' + r.id + '">' +
        '<label class="admin-content-label">' + escapeHtml(r.label) + '</label>' +
        field +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-content" style="width:fit-content;">Zapisz</button>' +
        '</div>'
      );
    }).join('');

    container.querySelectorAll('[data-action="save-content"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-content-row');
        var id = Number(row.getAttribute('data-row-id'));
        var value = row.querySelector('[data-field="value"]').value.trim();
        client.from('site_content').update({ value: value }).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano treść.', 'success');
        });
      });
    });
  }

  // ---------- ZDJĘCIE LEKTORA ----------

  function loadPhotoAdmin() {
    var preview = document.getElementById('admin-photo-preview');
    if (!preview) return;
    client.from('site_content').select('*').eq('key', 'lektor_photo_url').single().then(function (res) {
      if (res.error || !res.data || !res.data.value) return;
      preview.src = res.data.value;
    });
  }

  var photoInput = document.getElementById('admin-photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      var msg = document.getElementById('admin-photo-message');
      var preview = document.getElementById('admin-photo-preview');
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = 'lektor-' + Date.now() + '.' + ext;

      showMessage(msg, 'Wgrywanie zdjęcia…', 'success');
      msg.style.display = 'block';

      client.storage.from('media').upload(path, file, { upsert: true }).then(function (uploadRes) {
        if (uploadRes.error) { showMessage(msg, 'Błąd wgrywania: ' + uploadRes.error.message, 'error'); return; }
        var publicUrlRes = client.storage.from('media').getPublicUrl(path);
        var publicUrl = publicUrlRes.data && publicUrlRes.data.publicUrl;
        if (!publicUrl) { showMessage(msg, 'Nie udało się pobrać adresu zdjęcia.', 'error'); return; }

        client.from('site_content').update({ value: publicUrl }).eq('key', 'lektor_photo_url').then(function (updateRes) {
          if (updateRes.error) { showMessage(msg, 'Błąd zapisu adresu zdjęcia: ' + updateRes.error.message, 'error'); return; }
          preview.src = publicUrl;
          showMessage(msg, 'Zdjęcie zaktualizowane — widoczne na stronie głównej i „O mnie”.', 'success');
        });
      });
    });
  }

  // ---------- FILMIKI - LEKCJE ----------

  function parseYoutubeId(input) {
    input = (input || '').trim();
    if (!input) return '';
    // Już samo ID (11 znaków, litery/cyfry/-/_)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    var patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = input.match(patterns[i]);
      if (m) return m[1];
    }
    return '';
  }

  function loadVideosAdmin() {
    client
      .from('video_lessons')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showMessage(globalMessage, 'Błąd wczytywania lekcji wideo: ' + res.error.message, 'error');
          return;
        }
        renderVideos(res.data);
      });
  }

  function renderVideos(rows) {
    var container = document.querySelector('[data-admin-videos]');
    if (!container) return;
    container.innerHTML = rows.map(function (v) {
      return (
        '<div class="admin-row-testimonial" data-row-id="' + v.id + '">' +
        '<input type="text" value="' + escapeHtml(v.title) + '" data-field="title" placeholder="Tytuł">' +
        '<textarea data-field="description" placeholder="Opis">' + escapeHtml(v.description) + '</textarea>' +
        '<input type="text" value="https://youtu.be/' + escapeHtml(v.youtube_id) + '" data-field="youtube_url" placeholder="Link do filmu na YouTube">' +
        '<input type="text" value="' + escapeHtml(v.level) + '" data-field="level" placeholder="Poziom (np. B1)" style="max-width:140px;">' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (v.published ? ' checked' : '') + '> opublikowana</label>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-video">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-video">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak dodanych lekcji wideo.</p>';

    container.querySelectorAll('[data-action="save-video"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var youtubeId = parseYoutubeId(row.querySelector('[data-field="youtube_url"]').value);
        if (!youtubeId) { showMessage(globalMessage, 'Nie rozpoznano linku do YouTube — sprawdź, czy jest poprawny.', 'error'); return; }
        var payload = {
          title: row.querySelector('[data-field="title"]').value.trim(),
          description: row.querySelector('[data-field="description"]').value.trim(),
          youtube_id: youtubeId,
          level: row.querySelector('[data-field="level"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked
        };
        client.from('video_lessons').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano lekcję wideo.', 'success');
          loadVideosAdmin();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-video"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('video_lessons').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto lekcję wideo.', 'success');
          loadVideosAdmin();
        });
      });
    });
  }

  var addVideoBtn = document.querySelector('[data-action="add-video"]');
  if (addVideoBtn) {
    addVideoBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-video]');
      var raw = {};
      inputs.forEach(function (input) { raw[input.getAttribute('data-field')] = input.value.trim(); });
      var youtubeId = parseYoutubeId(raw.youtube_url);
      if (!raw.title || !youtubeId) { showMessage(globalMessage, 'Podaj tytuł i poprawny link do filmu na YouTube.', 'error'); return; }
      var payload = {
        title: raw.title,
        description: raw.description || '',
        youtube_id: youtubeId,
        level: raw.level || '',
        sort_order: 999,
        published: true
      };
      client.from('video_lessons').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        showMessage(globalMessage, 'Dodano nową lekcję wideo.', 'success');
        loadVideosAdmin();
      });
    });
  }

  // ---------- WEBINARY ----------

  function loadWebinarsAdmin() {
    client
      .from('webinars')
      .select('*')
      .order('event_date', { ascending: true })
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania webinarów: ' + res.error.message, 'error'); return; }
        renderWebinarsAdmin(res.data);
      });
  }

  function renderWebinarsAdmin(rows) {
    var container = document.querySelector('[data-admin-webinars]');
    if (!container) return;
    container.innerHTML = rows.map(function (w) {
      var imageUrl = w.image_url || '';
      return (
        '<div class="admin-row-testimonial" data-row-id="' + w.id + '" data-image-url="' + escapeHtml(imageUrl) + '" style="flex-direction:column; align-items:stretch;">' +
        '<div class="admin-photo-upload admin-photo-upload-wide" style="margin-bottom:10px;">' +
        '<img data-webinar-image-preview src="' + escapeHtml(imageUrl) + '" alt="Obrazek marketingowy"' + (imageUrl ? '' : ' style="display:none;"') + '>' +
        '<div class="stack gap-sm">' +
        '<input type="file" accept="image/png, image/jpeg, image/webp" data-webinar-image-input>' +
        '<div class="admin-message" data-webinar-image-message style="display:none;"></div>' +
        '</div>' +
        '</div>' +
        '<div class="admin-add-row" style="margin:0;">' +
        '<input type="text" value="' + escapeHtml(w.title) + '" data-field="title" placeholder="Temat webinaru">' +
        '<input type="text" value="' + escapeHtml(w.speaker_name) + '" data-field="speaker_name" placeholder="Prowadzący">' +
        '<input type="text" value="' + escapeHtml(w.speaker_bio) + '" data-field="speaker_bio" placeholder="O prowadzącym">' +
        '<input type="date" value="' + escapeHtml(w.event_date || '') + '" data-field="event_date">' +
        '<input type="time" value="' + escapeHtml(w.event_time || '') + '" data-field="event_time">' +
        '<textarea data-field="description" placeholder="Opis">' + escapeHtml(w.description) + '</textarea>' +
        '<input type="text" value="' + escapeHtml(w.link_url) + '" data-field="link_url" placeholder="Link">' +
        '<input type="text" value="' + escapeHtml(w.link_label) + '" data-field="link_label" placeholder="Podpis przycisku">' +
        '</div>' +
        '<div class="row-wrap gap-sm" style="margin-top:8px; align-items:center;">' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="published"' + (w.published ? ' checked' : '') + '> opublikowany</label>' +
        '<span class="text-muted" style="font-size:13px;" data-webinar-reg-count>Zapisani: …</span>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="toggle-webinar-regs">Pokaż zgłoszenia</button>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-webinar">Zapisz</button>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-webinar">Usuń</button>' +
        '</div>' +
        '<div class="admin-registrations-list" data-webinar-regs-list style="display:none;"></div>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych webinarów.</p>';

    container.querySelectorAll('[data-webinar-image-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        var row = input.closest('.admin-row-testimonial');
        var preview = row.querySelector('[data-webinar-image-preview]');
        var message = row.querySelector('[data-webinar-image-message]');
        var file = input.files && input.files[0];
        if (!file) return;
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var path = 'webinar-images/photo-' + Date.now() + '.' + ext;
        showMessage(message, 'Wgrywanie obrazka…', 'success');
        client.storage.from('media').upload(path, file, { upsert: true }).then(function (uploadRes) {
          if (uploadRes.error) { showMessage(message, 'Błąd wgrywania: ' + uploadRes.error.message, 'error'); return; }
          var publicUrlRes = client.storage.from('media').getPublicUrl(path);
          var publicUrl = publicUrlRes.data && publicUrlRes.data.publicUrl;
          if (!publicUrl) { showMessage(message, 'Nie udało się pobrać adresu obrazka.', 'error'); return; }
          row.setAttribute('data-image-url', publicUrl);
          if (preview) { preview.src = publicUrl; preview.style.display = ''; }
          showMessage(message, 'Obrazek gotowy — zapisze się po kliknięciu „Zapisz”.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="save-webinar"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var payload = {
          title: row.querySelector('[data-field="title"]').value.trim(),
          speaker_name: row.querySelector('[data-field="speaker_name"]').value.trim(),
          speaker_bio: row.querySelector('[data-field="speaker_bio"]').value.trim(),
          event_date: row.querySelector('[data-field="event_date"]').value || null,
          event_time: row.querySelector('[data-field="event_time"]').value.trim(),
          description: row.querySelector('[data-field="description"]').value.trim(),
          link_url: row.querySelector('[data-field="link_url"]').value.trim(),
          link_label: row.querySelector('[data-field="link_label"]').value.trim(),
          published: row.querySelector('[data-field="published"]').checked,
          image_url: row.getAttribute('data-image-url') || ''
        };
        client.from('webinars').update(payload).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano webinar.', 'success');
          loadWebinarsAdmin();
        });
      });
    });

    container.querySelectorAll('[data-action="delete-webinar"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('webinars').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto webinar.', 'success');
          loadWebinarsAdmin();
        });
      });
    });

    function renderRegistrationsList(list, webinarId, countEl) {
      client.from('webinar_registrations').select('*').eq('webinar_id', webinarId).order('created_at', { ascending: true }).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd wczytywania zgłoszeń: ' + res.error.message, 'error'); return; }
        if (countEl) countEl.textContent = 'Zapisani: ' + res.data.length;
        list.innerHTML = res.data.length
          ? res.data.map(function (r) {
              return (
                '<div class="admin-registrations-list-item row-wrap gap-sm" style="justify-content:space-between; align-items:center;" data-registration-id="' + r.id + '">' +
                '<span>' + escapeHtml(r.name) + ' — ' + escapeHtml(r.email) + '</span>' +
                '<button type="button" class="btn btn-danger btn-xs" data-action="delete-registration" data-registration-id="' + r.id + '" data-webinar-id="' + webinarId + '">Usuń</button>' +
                '</div>'
              );
            }).join('')
          : '<p class="text-muted" style="font-size:12.5px;">Nikt jeszcze się nie zapisał.</p>';

        list.querySelectorAll('[data-action="delete-registration"]').forEach(function (delBtn) {
          delBtn.addEventListener('click', function () {
            var regId = Number(delBtn.getAttribute('data-registration-id'));
            client.from('webinar_registrations').delete().eq('id', regId).then(function (delRes) {
              if (delRes.error) { showMessage(globalMessage, 'Błąd usuwania zgłoszenia: ' + delRes.error.message, 'error'); return; }
              showMessage(globalMessage, 'Usunięto zgłoszenie.', 'success');
              renderRegistrationsList(list, webinarId, countEl);
            });
          });
        });
      });
    }

    container.querySelectorAll('[data-action="toggle-webinar-regs"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var list = row.querySelector('[data-webinar-regs-list]');
        var countEl = row.querySelector('[data-webinar-reg-count]');
        if (!list) return;
        var isHidden = list.style.display === 'none' || !list.style.display;
        if (!isHidden) { list.style.display = 'none'; btn.textContent = 'Pokaż zgłoszenia'; return; }
        renderRegistrationsList(list, id, countEl);
        list.style.display = 'block';
        btn.textContent = 'Ukryj zgłoszenia';
      });
    });

    // Liczba zapisanych — wczytywana od razu przy każdym webinarze, żeby
    // administrator widział ją bez klikania "Pokaż zgłoszenia".
    rows.forEach(function (w) {
      var row = container.querySelector('.admin-row-testimonial[data-row-id="' + w.id + '"]');
      if (!row) return;
      var countEl = row.querySelector('[data-webinar-reg-count]');
      if (!countEl) return;
      client.from('webinar_registrations').select('*').eq('webinar_id', w.id).then(function (res) {
        if (res.error) { countEl.textContent = 'Zapisani: błąd wczytywania'; return; }
        countEl.textContent = 'Zapisani: ' + res.data.length;
      });
    });
  }

  // ---------- WEBINARY: obrazek marketingowy przy dodawaniu nowego ----------

  var newWebinarImageInput = document.getElementById('new-webinar-image-input');
  var newWebinarImagePreview = document.getElementById('new-webinar-image-preview');
  var newWebinarImageMessage = document.getElementById('new-webinar-image-message');
  var newWebinarImageUrl = '';

  if (newWebinarImageInput) {
    newWebinarImageInput.addEventListener('change', function () {
      var file = newWebinarImageInput.files && newWebinarImageInput.files[0];
      if (!file) return;
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = 'webinar-images/photo-' + Date.now() + '.' + ext;
      showMessage(newWebinarImageMessage, 'Wgrywanie obrazka…', 'success');
      client.storage.from('media').upload(path, file, { upsert: true }).then(function (uploadRes) {
        if (uploadRes.error) { showMessage(newWebinarImageMessage, 'Błąd wgrywania: ' + uploadRes.error.message, 'error'); return; }
        var publicUrlRes = client.storage.from('media').getPublicUrl(path);
        var publicUrl = publicUrlRes.data && publicUrlRes.data.publicUrl;
        if (!publicUrl) { showMessage(newWebinarImageMessage, 'Nie udało się pobrać adresu obrazka.', 'error'); return; }
        newWebinarImageUrl = publicUrl;
        if (newWebinarImagePreview) { newWebinarImagePreview.src = publicUrl; newWebinarImagePreview.style.display = ''; }
        showMessage(newWebinarImageMessage, 'Obrazek gotowy — zapisze się razem z nowym webinarem.', 'success');
      });
    });
  }

  var addWebinarBtn = document.querySelector('[data-action="add-webinar"]');
  if (addWebinarBtn) {
    addWebinarBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('[data-new-webinar]');
      var payload = { sort_order: 999, published: true, image_url: newWebinarImageUrl || '' };
      inputs.forEach(function (input) { payload[input.getAttribute('data-field')] = input.value.trim(); });
      if (!payload.event_date) payload.event_date = null;
      if (!payload.title || !payload.speaker_name) { showMessage(globalMessage, 'Podaj przynajmniej temat i prowadzącego.', 'error'); return; }
      client.from('webinars').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania: ' + res.error.message, 'error'); return; }
        inputs.forEach(function (input) { input.value = ''; });
        newWebinarImageUrl = '';
        if (newWebinarImagePreview) { newWebinarImagePreview.src = ''; newWebinarImagePreview.style.display = 'none'; }
        if (newWebinarImageInput) newWebinarImageInput.value = '';
        if (newWebinarImageMessage) newWebinarImageMessage.style.display = 'none';
        showMessage(globalMessage, 'Dodano nowy webinar.', 'success');
        loadWebinarsAdmin();
      });
    });
  }

  // ---------- DIAGNOZA POGŁĘBIONA: kody dostępu ----------

  function loadDiagnosisAdmin() {
    loadDiagnosisCodesAdmin();
    loadDiagnosisResultsAdmin();
  }

  function loadDiagnosisCodesAdmin() {
    client.from('diagnosis_codes').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { showMessage(globalMessage, 'Błąd wczytywania kodów: ' + res.error.message, 'error'); return; }
      renderDiagnosisCodesAdmin(res.data);
    });
  }

  function renderDiagnosisCodesAdmin(rows) {
    var container = document.querySelector('[data-admin-diagnosis-codes]');
    if (!container) return;
    container.innerHTML = rows.map(function (c) {
      var statusLabel = c.used_at ? ('użyty ' + new Date(c.used_at).toLocaleDateString('pl-PL')) : 'nieużyty';
      var streakLabel = (c.streak_count && c.streak_count >= 2) ? (' · 🔥 ' + c.streak_count + ' dni z rzędu') : '';
      return (
        '<div class="admin-row-testimonial" data-row-id="' + c.id + '">' +
        '<div class="stack gap-xs" style="flex:1 1 220px;">' +
        '<span class="text-strong">' + escapeHtml(c.student_name || '(bez nazwiska)') + '</span>' +
        '<span class="text-muted" style="font-size:12.5px;"><code>' + escapeHtml(c.code) + '</code> · ' + statusLabel + streakLabel + '</span>' +
        '<input type="text" value="' + escapeHtml(c.goal_text || '') + '" data-field="goal_text" placeholder="Cel nauki kursanta (opcjonalnie)" style="margin-top:4px;">' +
        '</div>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="copy-diagnosis-code">Kopiuj kod</button>' +
        '<button type="button" class="btn btn-outline btn-xs" data-action="save-diagnosis-goal">Zapisz cel</button>' +
        '<label class="admin-checkbox"><input type="checkbox" data-field="active"' + (c.active ? ' checked' : '') + '> aktywny</label>' +
        '<button type="button" class="btn btn-danger btn-xs" data-action="delete-diagnosis-code">Usuń</button>' +
        '</div>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak wygenerowanych kodów.</p>';

    container.querySelectorAll('[data-action="save-diagnosis-goal"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        var goalText = row.querySelector('[data-field="goal_text"]').value.trim();
        client.from('diagnosis_codes').update({ goal_text: goalText }).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu celu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Zapisano cel nauki.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="copy-diagnosis-code"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var code = row.querySelector('code').textContent;
        try {
          navigator.clipboard && navigator.clipboard.writeText(code);
          btn.textContent = 'Skopiowano ✓';
          setTimeout(function () { btn.textContent = 'Kopiuj kod'; }, 1500);
        } catch (e) {}
      });
    });

    container.querySelectorAll('[data-field="active"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var row = checkbox.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('diagnosis_codes').update({ active: checkbox.checked }).eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd zapisu: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, checkbox.checked ? 'Kod aktywowany.' : 'Kod dezaktywowany.', 'success');
        });
      });
    });

    container.querySelectorAll('[data-action="delete-diagnosis-code"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.admin-row-testimonial');
        var id = Number(row.getAttribute('data-row-id'));
        client.from('diagnosis_codes').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto kod.', 'success');
          loadDiagnosisCodesAdmin();
        });
      });
    });
  }

  function randomDiagnosisCode() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez znakow latwych do pomylenia: 0/O, 1/I/L
    var out = '';
    for (var i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  var generateDiagnosisCodeBtn = document.getElementById('generate-diagnosis-code');
  if (generateDiagnosisCodeBtn) {
    generateDiagnosisCodeBtn.addEventListener('click', function () {
      var input = document.getElementById('new-diagnosis-code');
      if (input) input.value = randomDiagnosisCode();
    });
  }

  var addDiagnosisCodeBtn = document.querySelector('[data-action="add-diagnosis-code"]');
  if (addDiagnosisCodeBtn) {
    addDiagnosisCodeBtn.addEventListener('click', function () {
      var nameInput = document.getElementById('new-diagnosis-name');
      var codeInput = document.getElementById('new-diagnosis-code');
      var code = (codeInput.value || '').trim() || randomDiagnosisCode();
      var payload = { student_name: (nameInput.value || '').trim(), code: code, active: true };
      client.from('diagnosis_codes').insert(payload).then(function (res) {
        if (res.error) { showMessage(globalMessage, 'Błąd dodawania (sprawdź, czy taki kod już nie istnieje): ' + res.error.message, 'error'); return; }
        nameInput.value = '';
        codeInput.value = '';
        showMessage(globalMessage, 'Dodano kod dostępu.', 'success');
        loadDiagnosisCodesAdmin();
      });
    });
  }

  // ---------- DIAGNOZA POGŁĘBIONA: wyniki ----------

  function loadDiagnosisResultsAdmin() {
    client.from('diagnosis_results').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { showMessage(globalMessage, 'Błąd wczytywania wyników: ' + res.error.message, 'error'); return; }
      renderDiagnosisResultsAdmin(res.data);
    });
  }

  function renderDiagnosisResultsAdmin(rows) {
    var container = document.querySelector('[data-admin-diagnosis-results]');
    if (!container) return;
    container.innerHTML = rows.map(function (r) {
      var levels = r.levels || {};
      var typeLabel = r.test_type === 'biznesowy' ? 'Test biznesowy' : 'Test ogólny';
      var levelsLine = [
        'Gramatyka: ' + (levels.grammar || '—'),
        'Słownictwo: ' + (levels.vocabulary || '—'),
        'Czytanie: ' + (levels.reading || '—'),
        'Słuchanie: ' + (levels.listening || '—'),
        'Mówienie: ' + (levels.speaking || '—')
      ].join(' · ');
      return (
        '<details class="diag-lvl" data-row-id="' + r.id + '">' +
        '<summary><span class="text-strong">' + escapeHtml(r.student_name || 'Kursant') + '</span> — ' + escapeHtml(typeLabel) +
        ' <span class="text-muted" style="font-size:12px;">(' + new Date(r.created_at).toLocaleString('pl-PL') + ')</span></summary>' +
        '<div style="padding:0 16px 16px;">' +
        '<p class="text-muted" style="font-size:12.5px; margin-bottom:10px;">' + escapeHtml(levelsLine) + '</p>' +
        '<textarea readonly rows="10" style="font-size:12.5px;">' + escapeHtml(r.report_text || '') + '</textarea>' +
        '<button type="button" class="btn btn-danger btn-xs" style="margin-top:10px;" data-action="delete-diagnosis-result">Usuń wynik</button>' +
        '</div>' +
        '</details>'
      );
    }).join('') || '<p class="text-muted" style="font-size:13px;">Brak zapisanych wyników.</p>';

    container.querySelectorAll('[data-action="delete-diagnosis-result"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var details = btn.closest('details');
        var id = Number(details.getAttribute('data-row-id'));
        client.from('diagnosis_results').delete().eq('id', id).then(function (res) {
          if (res.error) { showMessage(globalMessage, 'Błąd usuwania: ' + res.error.message, 'error'); return; }
          showMessage(globalMessage, 'Usunięto wynik.', 'success');
          loadDiagnosisResultsAdmin();
        });
      });
    });
  }
})();
