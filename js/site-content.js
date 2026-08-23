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
})();
