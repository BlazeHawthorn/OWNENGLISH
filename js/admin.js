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
    loadTutorsAdmin();
    loadScheduleAdmin();
    loadNavVisibility();
    loadPricingAdmin();
    loadTestimonialsAdmin();
    loadContactAdmin();
    loadFaqAdmin();
    loadWordsAdmin();
    loadSiteContentAdmin();
    loadPhotoAdmin();
    loadVideosAdmin();
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
      return sum + (minutes / 60) * currentHourlyRate;
    }, 0);

    labelEl.textContent = monthLabel(summaryMonthStart);
    countEl.textContent = String(relevant.length);
    earningsEl.textContent = totalEarnings.toFixed(2).replace('.', ',') + ' zł';
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
      return (
        '<div class="admin-row" data-row-id="' + r.id + '"' + (r.series_id ? ' data-series-id="' + r.series_id + '"' : '') + '>' +
        '<span style="min-width:110px;">' + escapeHtml(r.lesson_date) + (r.lesson_time ? ' ' + escapeHtml(r.lesson_time) : '') + '</span>' +
        '<span class="text-muted" style="min-width:50px; font-size:12px;">' + (r.duration_minutes || 60) + ' min</span>' +
        '<span style="flex:1 1 140px;">' + escapeHtml(r.student_name) + '</span>' +
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
})();
