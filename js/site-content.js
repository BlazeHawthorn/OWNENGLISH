/* ==========================================================================
   OwnEnglish — dynamiczna treść z panelu administracyjnego (Supabase)
   Podmienia w locie: tabele cennika, opinie kursantów i dane kontaktowe —
   ale TYLKO jeśli Supabase jest skonfigurowany (patrz supabase-config.js)
   i zapytanie się powiedzie. W każdym innym przypadku (brak konfiguracji,
   błąd sieci, pusta tabela) strona zostaje przy treści wpisanej na sztywno
   w HTML — nic się nie psuje i nic nie znika.
   ========================================================================== */

(function () {
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
    try {
      return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    } catch (e) {
      return null;
    }
  }

  var client = getClient();
  if (!client) return; // brak konfiguracji Supabase — zostaje statyczna treść z HTML

  document.addEventListener('DOMContentLoaded', function () {
    loadPricing();
    loadTestimonials();
    loadContactInfo();
    loadSiteContent();
    loadFaq();
    loadVideoLessons();
    loadTutors();
    loadWordOfDay();
    loadWebinars();
    applyNavVisibility();
  });

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadPricing() {
    var indivBody = document.querySelector('[data-pricing="individual"]');
    var groupBody = document.querySelector('[data-pricing="group"]');
    if (!indivBody && !groupBody) return;

    client
      .from('pricing_packages')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return;

        function rowHtml(r) {
          return (
            '<tr><td>' + escapeHtml(r.name) + '</td><td>' +
            escapeHtml(r.detail) + '</td><td>' +
            escapeHtml(r.price) + '</td></tr>'
          );
        }

        if (indivBody) {
          var indiv = res.data.filter(function (r) { return r.category === 'individual'; });
          if (indiv.length) indivBody.innerHTML = indiv.map(rowHtml).join('');
        }
        if (groupBody) {
          var group = res.data.filter(function (r) { return r.category === 'group'; });
          if (group.length) groupBody.innerHTML = group.map(rowHtml).join('');
        }
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  function loadTestimonials() {
    var wrap = document.querySelector('[data-testimonials]');
    if (!wrap) return;

    client
      .from('testimonials')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return;

        wrap.innerHTML = res.data.map(function (t) {
          return (
            '<div class="card-outline stack gap-lg">' +
            '<svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 20V11.5C0 5.15 4.02 1.15 10.5 0L11.5 3.2C7.4 4.3 5.3 6.5 5.1 9.5H10.5V20H0ZM16.5 20V11.5C16.5 5.15 20.52 1.15 27 0L28 3.2C23.9 4.3 21.8 6.5 21.6 9.5H27V20H16.5Z" fill="#16A34A" opacity="0.55"/></svg>' +
            '<p style="font-style:italic;">' + escapeHtml(t.quote) + '</p>' +
            '<div class="row gap-sm">' +
            '<span class="circle circle-sm">' + escapeHtml(t.initials) + '</span>' +
            '<div class="stack" style="gap:2px;">' +
            '<span style="font-size:14.5px; font-weight:600; color:var(--color-ink);">' + escapeHtml(t.name) + '</span>' +
            '<span class="text-muted" style="font-size:13px;">' + escapeHtml(t.role) + '</span>' +
            '</div></div></div>'
          );
        }).join('');
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  function loadContactInfo() {
    var emailEls = document.querySelectorAll('[data-field="contact-email"]');
    var phoneEls = document.querySelectorAll('[data-field="contact-phone"]');
    var locationEls = document.querySelectorAll('[data-field="contact-location"]');
    if (!emailEls.length && !phoneEls.length && !locationEls.length) return;

    client
      .from('contact_info')
      .select('*')
      .eq('id', 1)
      .single()
      .then(function (res) {
        if (res.error || !res.data) return;
        var d = res.data;

        if (d.email) {
          emailEls.forEach(function (el) {
            el.textContent = d.email;
            if (el.tagName === 'A') el.href = 'mailto:' + d.email;
          });
        }
        if (d.phone) {
          phoneEls.forEach(function (el) {
            el.textContent = d.phone;
            if (el.tagName === 'A') el.href = 'tel:' + d.phone.replace(/\s+/g, '');
          });
        }
        if (d.location) {
          locationEls.forEach(function (el) { el.textContent = d.location; });
        }
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  // ---------- TREŚCI STRON (site_content) + ZDJĘCIE LEKTORA ----------

  function loadSiteContent() {
    var els = document.querySelectorAll('[data-content-key]');
    if (!els.length) return;

    client
      .from('site_content')
      .select('*')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return;

        var byKey = {};
        res.data.forEach(function (row) { byKey[row.key] = row.value; });

        els.forEach(function (el) {
          var key = el.getAttribute('data-content-key');
          var value = byKey[key];
          if (value === undefined || value === null || value === '') return; // brak wartości — zostaje placeholder

          if (el.tagName === 'IMG') {
            el.src = value;
            var frame = el.closest('.photo-frame');
            var badge = frame ? frame.querySelector('[data-photo-badge]') : null;
            if (badge) badge.style.display = 'none';
          } else {
            el.textContent = value;
          }
        });
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  // ---------- FAQ ----------

  function loadFaq() {
    var wrap = document.querySelector('[data-faq-list]');
    if (!wrap) return;

    client
      .from('faq_items')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // zostają statyczne pytania z HTML

        wrap.innerHTML = res.data.map(function (f) {
          return (
            '<div class="faq-item">' +
            '<h3>' + escapeHtml(f.question) + '</h3>' +
            '<p class="text-muted">' + escapeHtml(f.answer) + '</p>' +
            '</div>'
          );
        }).join('');
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  // ---------- LEKCJE WIDEO ----------

  function loadVideoLessons() {
    var wrap = document.querySelector('[data-video-lessons]');
    if (!wrap) return;

    client
      .from('video_lessons')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // zostaje komunikat "brak lekcji" z HTML

        wrap.innerHTML = res.data.map(function (v) {
          return (
            '<div class="card video-card stack gap-sm">' +
            '<div class="video-embed">' +
            '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(v.youtube_id) + '" ' +
            'title="' + escapeHtml(v.title) + '" loading="lazy" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
            'allowfullscreen></iframe>' +
            '</div>' +
            '<div class="stack gap-xs">' +
            (v.level ? '<span class="badge badge-outline" style="width:fit-content;">' + escapeHtml(v.level) + '</span>' : '') +
            '<h3 style="font-size:17px;">' + escapeHtml(v.title) + '</h3>' +
            (v.description ? '<p class="text-muted" style="font-size:14px;">' + escapeHtml(v.description) + '</p>' : '') +
            '</div></div>'
          );
        }).join('');
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  // ---------- NASZ ZESPÓŁ (tutor_profiles) ----------

  function loadTutors() {
    var wrap = document.querySelector('[data-tutors-list]');
    if (!wrap) return;

    client
      .from('tutor_profiles')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // zostaje komunikat "zespół się powiększa" z HTML

        wrap.innerHTML = res.data.map(function (t) {
          return (
            '<div class="card stack gap-sm" style="text-align:center; align-items:center;">' +
            '<div class="photo-frame" style="max-width:140px; aspect-ratio:1/1;">' +
            '<img src="' + escapeHtml(t.photo_url || 'img/lektor-przyklad.svg') + '" alt="Zdjęcie — ' + escapeHtml(t.name) + '">' +
            '</div>' +
            '<h3 style="font-size:17px; margin-top:8px;">' + escapeHtml(t.name) + '</h3>' +
            (t.bio ? '<p class="text-muted" style="font-size:14px;">' + escapeHtml(t.bio) + '</p>' : '') +
            '</div>'
          );
        }).join('');
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  // ---------- SŁOWO NA DZIŚ (words_of_day) ----------

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

        // Ten sam dzień = to samo słówko dla każdego odwiedzającego; lista
        // zapętla się od początku, gdy się skończy.
        var epochDay = Math.floor(Date.now() / 86400000);
        var word = res.data[epochDay % res.data.length];

        function setField(name, value) {
          if (!value) return;
          var el = card.querySelector('[data-word-field="' + name + '"]');
          if (el) el.textContent = value;
        }

        setField('word', word.word);
        setField('part_of_speech', word.part_of_speech);
        setField('pronunciation', word.pronunciation);
        setField('dialect_label', word.dialect_label);
        setField('definition', word.definition);
      })
      .catch(function () { /* zostaw statyczną kartę */ });
  }

  // ---------- WEBINARY (webinars) ----------

  var MONTHS_PL_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

  function formatWebinarDate(dateStr, timeStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-'); // oczekiwany format YYYY-MM-DD
    if (parts.length !== 3) return dateStr;
    var day = parseInt(parts[2], 10);
    var month = MONTHS_PL_GENITIVE[parseInt(parts[1], 10) - 1] || '';
    var label = day + ' ' + month + ' ' + parts[0];
    if (timeStr) label += ', ' + timeStr;
    return label;
  }

  function loadWebinars() {
    var wrap = document.querySelector('[data-webinars-list]');
    if (!wrap) return;

    client
      .from('webinars')
      .select('*')
      .eq('published', true)
      .order('event_date', { ascending: true })
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // zostaje komunikat "wkrótce" z HTML

        wrap.innerHTML = res.data.map(function (w) {
          var dateLabel = formatWebinarDate(w.event_date, w.event_time);
          return (
            '<div class="card stack gap-sm">' +
            (w.image_url ? '<img src="' + escapeHtml(w.image_url) + '" alt="' + escapeHtml(w.title) + '" class="webinar-image">' : '') +
            '<div class="row-wrap gap-sm" style="justify-content:space-between; align-items:flex-start;">' +
            '<h3 style="font-size:19px;">' + escapeHtml(w.title) + '</h3>' +
            (dateLabel ? '<span class="badge badge-tint" style="white-space:nowrap;">' + escapeHtml(dateLabel) + '</span>' : '') +
            '</div>' +
            '<div class="text-muted" style="font-size:14px;"><strong style="color:var(--color-ink);">' + escapeHtml(w.speaker_name) + '</strong>' + (w.speaker_bio ? ' — ' + escapeHtml(w.speaker_bio) : '') + '</div>' +
            (w.description ? '<p style="font-size:14.5px;">' + escapeHtml(w.description) + '</p>' : '') +
            (w.link_url ? '<a href="' + escapeHtml(w.link_url) + '" class="btn btn-primary btn-sm" style="width:fit-content;" target="_blank" rel="noopener">' + escapeHtml(w.link_label || 'Dołącz') + '</a>' : '') +
            '<div class="webinar-registration">' +
            '<p class="text-strong" style="font-size:14px; margin-bottom:10px;">Zapisz się na ten webinar</p>' +
            '<form class="stack gap-sm" data-webinar-register-form data-webinar-id="' + w.id + '">' +
            '<div class="field">' +
            '<label for="webinar-name-' + w.id + '">Imię i nazwisko</label>' +
            '<input type="text" id="webinar-name-' + w.id + '" data-webinar-name required placeholder="Twoje imię i nazwisko">' +
            '</div>' +
            '<div class="field">' +
            '<label for="webinar-email-' + w.id + '">E-mail</label>' +
            '<input type="email" id="webinar-email-' + w.id + '" data-webinar-email required placeholder="ty@przyklad.pl">' +
            '</div>' +
            '<label class="form-consent">' +
            '<input type="checkbox" data-webinar-consent required>' +
            '<span>Zgadzam się na przetwarzanie moich danych (imię, e-mail) w celu zapisania mnie na ten webinar.</span>' +
            '</label>' +
            '<button type="submit" class="btn btn-primary btn-sm" style="width:fit-content;">Zapisz się</button>' +
            '<div class="admin-message" data-webinar-register-message style="display:none;"></div>' +
            '</form>' +
            '</div>' +
            '</div>'
          );
        }).join('');

        wrap.querySelectorAll('[data-webinar-register-form]').forEach(function (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var webinarId = Number(form.getAttribute('data-webinar-id'));
            var nameInput = form.querySelector('[data-webinar-name]');
            var emailInput = form.querySelector('[data-webinar-email]');
            var consentInput = form.querySelector('[data-webinar-consent]');
            var messageEl = form.querySelector('[data-webinar-register-message]');
            var name = nameInput.value.trim();
            var email = emailInput.value.trim();
            if (!name || !email || !consentInput.checked) {
              setInlineMessage(messageEl, 'Uzupełnij imię, e-mail i zaznacz zgodę na przetwarzanie danych.', 'error');
              return;
            }
            var submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            client.from('webinar_registrations').insert({
              webinar_id: webinarId,
              name: name,
              email: email,
              consent: true
            }).then(function (res) {
              if (submitBtn) submitBtn.disabled = false;
              if (res.error) {
                var isDuplicate = res.error.code === '23505' || /duplicate|unique/i.test(res.error.message || '');
                setInlineMessage(messageEl, isDuplicate ? 'Jesteś już zapisany/a na ten webinar — do zobaczenia!' : 'Błąd zapisu: ' + res.error.message, isDuplicate ? 'success' : 'error');
                return;
              }
              setInlineMessage(messageEl, 'Zapisano! Do zobaczenia na webinarze.', 'success');
              form.reset();
            });
          });
        });
      })
      .catch(function () { /* zostaw statyczną treść */ });
  }

  function setInlineMessage(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'admin-message is-' + kind;
    el.style.display = 'block';
  }

  // ---------- WIDOCZNOŚĆ ZAKŁADEK (nav_visibility) ----------

  var NAV_KEY_BY_HREF = {
    'oferta.html': 'oferta',
    'dla-firm.html': 'dla-firm',
    'cennik.html': 'cennik',
    'o-mnie.html': 'o-mnie',
    'zespol.html': 'zespol',
    'lekcje.html': 'lekcje',
    'webinary.html': 'webinary',
    'faq.html': 'faq'
  };

  function applyNavVisibility() {
    client
      .from('nav_visibility')
      .select('*')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // brak danych — wszystkie zakładki zostają widoczne

        var hiddenKeys = res.data
          .filter(function (r) { return r.visible === false; })
          .map(function (r) { return r.page_key; });
        if (!hiddenKeys.length) return;

        // 1) ukryj odpowiadające linki wszędzie na stronie (menu górne, stopka,
        // odnośniki w treści) — nie tylko w głównym menu, żeby link do wyłączonej
        // strony nie został przypadkiem widoczny gdzie indziej
        document.querySelectorAll('a[href]').forEach(function (link) {
          var key = NAV_KEY_BY_HREF[link.getAttribute('href')];
          if (key && hiddenKeys.indexOf(key) !== -1) link.style.display = 'none';
        });

        // 2) jeśli TA strona jest wyłączona — zablokuj jej treść komunikatem
        var thisKey = document.body.getAttribute('data-page-key');
        if (thisKey && hiddenKeys.indexOf(thisKey) !== -1) {
          var pageBody = document.getElementById('page-body');
          var notice = document.getElementById('page-disabled-notice');
          if (pageBody) pageBody.style.display = 'none';
          if (notice) notice.style.display = 'block';
        }
      })
      .catch(function () { /* w razie błędu zostają wszystkie zakładki widoczne */ });
  }
})();
