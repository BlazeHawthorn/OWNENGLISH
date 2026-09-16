/* ==========================================================================
   OwnEnglish — Diagnoza pogłębiona — silnik testu + brama kodu dostępu
   Obsługuje OBA testy (ogólny i biznesowy — treść w osobnych plikach
   js/diagnoza-content-general.js / js/diagnoza-content-business.js).
   Dostęp do całej strony wymaga indywidualnego kodu nadanego przez
   administratora w panelu (sekcja "Diagnoza pogłębiona"). Po zakończeniu
   testu wynik zapisuje się automatycznie w bazie (tabela diagnosis_results)
   i jest widoczny w panelu administratora.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  var LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  var LVL_COLOR = { A1: "#79c69a", A2: "#57b378", B1: "#399a5f", B2: "#227a49", C1: "#155c37", C2: "#0a3a22" };

  // --------------------------------------------------------------------
  // BRAMA KODU DOSTĘPU
  // --------------------------------------------------------------------
  var gateScreen = document.getElementById('gate-screen');
  var menuScreen = document.getElementById('menu-screen');
  var engineScreen = document.getElementById('engine-screen');
  var gateCode = document.getElementById('gate-code');
  var gateSubmit = document.getElementById('gate-submit');
  var gateError = document.getElementById('gate-error');
  var menuStudentName = document.getElementById('menu-student-name');
  var chooseGeneralBtn = document.getElementById('choose-general');
  var chooseBusinessBtn = document.getElementById('choose-business');

  if (!gateScreen) return; // strona jeszcze nie ma tej struktury — nic do zrobienia

  var studentName = '';
  var accessCode = '';

  function showGateError(msg) {
    gateError.textContent = msg;
    gateError.style.display = 'block';
  }

  function submitCode() {
    var code = (gateCode.value || '').trim();
    if (!code) { showGateError('Wpisz kod dostępu.'); return; }
    gateError.style.display = 'none';
    gateSubmit.disabled = true;
    gateSubmit.textContent = 'Sprawdzam…';
    client.rpc('check_diagnosis_code', { p_code: code }).then(function (res) {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      if (res.error || !res.data || !res.data.length) {
        showGateError('Nieprawidłowy kod dostępu. Sprawdź, czy wpisałeś/aś go dokładnie tak, jak otrzymałeś/aś od lektora.');
        return;
      }
      accessCode = code;
      studentName = ((res.data[0] && res.data[0].student_name) || '').trim();
      menuStudentName.textContent = studentName || 'Kursancie';
      gateScreen.style.display = 'none';
      menuScreen.style.display = 'block';
    }).catch(function () {
      gateSubmit.disabled = false;
      gateSubmit.textContent = 'Wejdź →';
      showGateError('Błąd połączenia. Spróbuj ponownie za chwilę.');
    });
  }

  gateSubmit.addEventListener('click', submitCode);
  gateCode.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitCode(); });

  if (chooseGeneralBtn) chooseGeneralBtn.addEventListener('click', function () { startTest(window.DIAGNOZA_GENERAL); });
  if (chooseBusinessBtn) chooseBusinessBtn.addEventListener('click', function () { startTest(window.DIAGNOZA_BUSINESS); });

  function startTest(CONTENT) {
    menuScreen.style.display = 'none';
    engineScreen.style.display = 'block';
    runEngine(CONTENT);
  }

  // --------------------------------------------------------------------
  // SILNIK TESTU (identyczny dla obu wariantów, parametryzowany treścią)
  // --------------------------------------------------------------------
  function runEngine(CONTENT) {
    var BANK = CONTENT.BANK, READING = CONTENT.READING, LISTENING = CONTENT.LISTENING,
        WRITING_TASKS = CONTENT.WRITING_TASKS, SPEAKING_PARTS = CONTENT.SPEAKING_PARTS, COPY = CONTENT.copy;

    var CONCORDANCE = [
      { cefr: "A1", ielts: "—", toefl: "—", cambridge: "—" },
      { cefr: "A2", ielts: "≈3.0–3.5", toefl: "≈30–41", cambridge: "A2 Key (KET)" },
      { cefr: "B1", ielts: "≈4.0–5.0", toefl: "≈42–71", cambridge: "B1 Preliminary (PET)" },
      { cefr: "B2", ielts: "≈5.5–6.5", toefl: "≈72–94", cambridge: "B2 First (FCE)" },
      { cefr: "C1", ielts: "≈7.0–8.0", toefl: "≈95–113", cambridge: "C1 Advanced (CAE)" },
      { cefr: "C2", ielts: "≈8.5–9.0", toefl: "≈114–120", cambridge: "C2 Proficiency (CPE)" }
    ];

    var RUBRIC_TEXT = "Kryteria oceny (dla każdego oceń pasujący poziom A1–A2 / B1 / B2 / C1–C2):\n" +
      "1) Zakres gramatyczny i poprawność — A1-A2: tylko najprostsze zdania, liczne błędy; B1: podstawowe czasy, błędy przy strukturach złożonych; B2: szeroki zakres struktur (strona bierna, warunki, mowa zależna), sporadyczne błędy; C1-C2: precyzyjne, zróżnicowane struktury.\n" +
      "2) Zakres i precyzja słownictwa — A1-A2: bardzo podstawowe, powtarzane; B1: wystarczające na znane tematy; B2: szerszy zasób, trafne kolokacje; C1-C2: precyzyjne, idiomatyczne.\n" +
      "3) Spójność i organizacja — A1-A2: zdania pojedyncze; B1: proste łączniki; B2: zróżnicowane łączniki, logiczna struktura; C1-C2: płynna, subtelna spójność.\n" +
      "4) Realizacja zadania — A1-A2: częściowa; B1: podstawowa; B2: pełna, z rozwinięciem; C1-C2: wyczerpująca, pogłębiona.";

    var state = {
      name: studentName || 'Kursant',
      grammar: {},
      grammarSectionIdx: 0, grammarItemIdx: 0, grammarSectionScores: [],
      grammarCeiling: null, grammarSubLevel: null, vocabSubLevel: null,
      readingIdx: 0, readingAnswers: {}, readingScores: [], readingCeiling: null,
      listeningIdx: 0, listeningAnswers: {}, listeningPlayed: 0, listeningScores: [], listeningCeiling: null,
      writingTask: null, writingText: "", writingResult: null,
      speaking: { fluency: "", grammar: "", vocab: "", pron: "", interaction: "", skipped: false },
      reportText: ""
    };

    var app = document.getElementById("app");

    function el(tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html !== undefined) e.innerHTML = html;
      return e;
    }

    function ladder(activeLevel, doneLevels) {
      var wrap = el("div");
      var bar = el("div", "diag-ladder");
      var labels = el("div", "diag-ladder-labels");
      LEVELS.forEach(function (lv) {
        var r = el("div", "diag-rung");
        r.style.setProperty("--lvl-color", LVL_COLOR[lv]);
        if (doneLevels.indexOf(lv) > -1) r.className += " done";
        if (lv === activeLevel) r.className += " current";
        bar.appendChild(r);
        labels.appendChild(el("span", null, lv));
      });
      wrap.appendChild(bar); wrap.appendChild(labels);
      return wrap;
    }

    function levelChip(level, text) {
      var c = el("span", "diag-chip", text || level);
      c.style.background = LVL_COLOR[level] || "var(--color-ink-soft)";
      return c;
    }

    function renderConcordanceTable() {
      var wrap = el("div");
      var table = el("table");
      table.style.width = "100%"; table.style.borderCollapse = "collapse"; table.style.fontSize = "13.5px"; table.style.marginTop = "10px";
      var thead = el("tr");
      ["CEFR", "IELTS", "TOEFL iBT", "Cambridge English"].forEach(function (h) {
        var th = el("th", null, h);
        th.style.textAlign = "left"; th.style.padding = "6px 8px"; th.style.borderBottom = "1px solid var(--color-border)"; th.style.color = "var(--color-ink-soft)";
        thead.appendChild(th);
      });
      table.appendChild(thead);
      CONCORDANCE.forEach(function (row) {
        var tr = el("tr");
        [row.cefr, row.ielts, row.toefl, row.cambridge].forEach(function (v, i) {
          var td = el("td", null, i === 0 ? "<b>" + v + "</b>" : v);
          td.style.padding = "6px 8px"; td.style.borderBottom = "1px solid var(--color-border)";
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      wrap.appendChild(el("p", null, "<small style=\"color:var(--color-ink-soft)\">Orientacyjne, publicznie dostępne odpowiedniki między skalami — nie są to wyniki tych egzaminów i nie zastępują ich certyfikatów. Ten test nie jest wydawany przez żadną z wymienionych organizacji.</small>"));
      return wrap;
    }

    // ---------- START ----------
    function renderStart() {
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", COPY.eyebrow));
      card.appendChild(el("h1", "h2-sm", COPY.title));
      card.appendChild(el("p", "text-muted", COPY.intro));
      var btnWrap = el("div", "row"); btnWrap.style.marginTop = "18px";
      var btn = el("button", "btn btn-primary", "Rozpocznij test →");
      btn.type = "button";
      btn.onclick = function () { startGrammar(); };
      btnWrap.appendChild(btn);
      card.appendChild(btnWrap);
      app.appendChild(card);

      var infoCard = el("div", "card");
      var det = el("details", "diag-lvl");
      det.appendChild(el("summary", null, "Jak to się ma do IELTS, TOEFL i Cambridge?"));
      var inner = el("div"); inner.style.padding = "10px 0 0";
      inner.appendChild(el("p", "text-muted", "Ten test wyraża wynik w skali CEFR — tej samej ramie odniesienia, na której oparte są też IELTS, TOEFL iBT i egzaminy Cambridge English. Struktura (test warstwowy dla gramatyki, rozmowa w 4 rosnących trudnością częściach dla mówienia) jest wzorowana na tych samych zasadach, na których działają uznawane testy poziomujące."));
      inner.appendChild(renderConcordanceTable());
      inner.appendChild(el("p", null, "<b>Ważne:</b> to test wewnętrzny do diagnozy przed zajęciami, nie zastępuje on żadnego z tych egzaminów i nie daje żadnego oficjalnie uznawanego certyfikatu."));
      det.appendChild(inner);
      infoCard.appendChild(det);
      app.appendChild(infoCard);
    }

    // ---------- GRAMMAR/VOCAB ----------
    function startGrammar() {
      state.grammarSectionIdx = 0; state.grammarSectionScores = []; state.grammar = {}; state.grammarItemIdx = 0;
      renderGrammarItem();
    }

    function currentGrammarLevel() { return LEVELS[state.grammarSectionIdx]; }

    function renderGrammarItem() {
      var level = currentGrammarLevel();
      var items = BANK[level];
      var idx = state.grammarItemIdx;
      if (!state.grammar[level]) state.grammar[level] = {};

      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(ladder(level, LEVELS.slice(0, state.grammarSectionIdx)));
      var eyebrow = el("div", "eyebrow"); eyebrow.style.marginTop = "16px";
      eyebrow.textContent = "Moduł 1 · Gramatyka i słownictwo · Sekcja " + level + " · pytanie " + (idx + 1) + "/" + items.length;
      card.appendChild(eyebrow);

      var item = items[idx];
      var h = el("h2", "h2-sm", item.prompt); h.style.marginTop = "10px";
      card.appendChild(h);

      var optWrap = el("div"); optWrap.style.marginTop = "16px";
      function chooseGrammarAnswer(value) {
        state.grammar[level][item.code] = value;
        if (idx + 1 < items.length) { state.grammarItemIdx++; renderGrammarItem(); }
        else { finishGrammarSection(); }
      }
      item.opts.forEach(function (optText, i) {
        var b = el("button", "diag-opt", "<b>" + String.fromCharCode(97 + i) + ")</b>&nbsp; " + optText);
        b.type = "button";
        b.onclick = function () { chooseGrammarAnswer(i); };
        optWrap.appendChild(b);
      });
      var idk = el("button", "diag-opt idk", "Nie znam odpowiedzi");
      idk.type = "button";
      idk.onclick = function () { chooseGrammarAnswer(-1); };
      optWrap.appendChild(idk);
      card.appendChild(optWrap);
      app.appendChild(card);
    }

    function finishGrammarSection() {
      var level = currentGrammarLevel();
      var items = BANK[level];
      var answers = state.grammar[level];
      var gTotal = 0, gCorrect = 0, vTotal = 0, vCorrect = 0;
      items.forEach(function (item) {
        var correct = answers[item.code] === item.ans;
        if (item.kind === "g") { gTotal++; if (correct) gCorrect++; } else { vTotal++; if (correct) vCorrect++; }
      });
      var combinedPct = (gCorrect + vCorrect) / (gTotal + vTotal);
      state.grammar[level]._score = { gCorrect: gCorrect, gTotal: gTotal, vCorrect: vCorrect, vTotal: vTotal, pct: combinedPct };
      state.grammarSectionScores.push(combinedPct);

      var scores = state.grammarSectionScores;
      var stop = scores.length >= 2 && scores[scores.length - 1] < 0.5 && scores[scores.length - 2] < 0.5;

      if (stop || state.grammarSectionIdx === LEVELS.length - 1) {
        computeGrammarLevels();
        startReading();
      } else {
        state.grammarSectionIdx++;
        state.grammarItemIdx = 0;
        renderSectionTransition(level, combinedPct);
      }
    }

    function renderSectionTransition(justFinishedLevel, pct) {
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Sekcja " + justFinishedLevel + " ukończona"));
      card.appendChild(el("h2", "h2-sm", pct >= 0.7 ? "Nieźle! Przechodzimy dalej." : "OK, sprawdźmy kolejny poziom."));
      app.appendChild(card);
      setTimeout(function () { renderGrammarItem(); }, 550);
    }

    function computeGrammarLevels() {
      var gLevel = null, vLevel = null;
      LEVELS.forEach(function (lv) {
        var s = state.grammar[lv] && state.grammar[lv]._score;
        if (!s) return;
        if (s.gTotal > 0 && s.gCorrect / s.gTotal >= 0.5) gLevel = lv;
        if (s.vTotal > 0 && s.vCorrect / s.vTotal >= 0.5) vLevel = lv;
      });
      state.grammarSubLevel = gLevel || "poniżej A1";
      state.vocabSubLevel = vLevel || "poniżej A1";
      state.grammarCeiling = gLevel || "A1";
    }

    // ---------- READING ----------
    function startReading() { state.readingIdx = 0; state.readingAnswers = {}; state.readingScores = []; renderReadingIntro(); }

    function renderReadingIntro() {
      var text = READING[state.readingIdx];
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Moduł 2 · Czytanie ze zrozumieniem · tekst " + (state.readingIdx + 1) + "/3 · poziom docelowy " + text.level));
      card.appendChild(el("h2", "h2-sm", text.title));
      card.appendChild(el("div", "diag-passage", text.text));
      var btn = el("button", "btn btn-primary", "Przejdź do pytań →"); btn.type = "button"; btn.style.marginTop = "14px";
      btn.onclick = function () { renderReadingQuestions(); };
      card.appendChild(btn);
      app.appendChild(card);
    }

    function renderOpenOrChoice(container, qList, onSubmit) {
      var answers = {};
      qList.forEach(function (q, qi) {
        var qw = el("div", "diag-qwrap");
        qw.appendChild(el("div", null, "<b>" + (qi + 1) + ".</b> " + q.q));
        if (q.open) {
          var ta = el("textarea"); ta.rows = 2; ta.style.marginTop = "8px";
          ta.oninput = function () { answers[qi] = ta.value; };
          qw.appendChild(ta);
        } else {
          var ow = el("div"); ow.style.marginTop = "8px";
          q.opts.forEach(function (o, oi) {
            var b = el("button", "diag-opt", String.fromCharCode(97 + oi) + ") " + o);
            b.type = "button";
            b.onclick = function () {
              Array.prototype.forEach.call(ow.children, function (c) { c.classList.remove("selected"); });
              b.classList.add("selected");
              answers[qi] = oi;
            };
            ow.appendChild(b);
          });
          var idkQ = el("button", "diag-opt idk", "Nie znam odpowiedzi");
          idkQ.type = "button";
          idkQ.onclick = function () {
            Array.prototype.forEach.call(ow.children, function (c) { c.classList.remove("selected"); });
            idkQ.classList.add("selected");
            answers[qi] = -1;
          };
          ow.appendChild(idkQ);
          qw.appendChild(ow);
        }
        container.appendChild(qw);
      });
      var submit = el("button", "btn btn-primary", "Zatwierdź odpowiedzi"); submit.type = "button"; submit.style.marginTop = "18px";
      submit.onclick = function () { onSubmit(answers); };
      container.appendChild(submit);
    }

    function scoreAnswers(qList, answers) {
      var correct = 0;
      qList.forEach(function (q, qi) {
        if (q.open) {
          var val = (answers[qi] || "").toLowerCase();
          if (q.kw.some(function (k) { return val.indexOf(k) > -1; })) correct++;
        } else if (answers[qi] === q.ans) correct++;
      });
      return correct;
    }

    function renderReadingQuestions() {
      var text = READING[state.readingIdx];
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Pytania do tekstu “" + text.title + "”"));
      renderOpenOrChoice(card, text.qs, function (answers) {
        var correct = scoreAnswers(text.qs, answers);
        state.readingAnswers[text.id] = { answers: answers, correct: correct, total: text.qs.length };
        state.readingScores.push({ level: text.level, pct: correct / text.qs.length });
        var pass = (correct / text.qs.length) >= 0.6;
        if (pass && state.readingIdx < READING.length - 1) { state.readingIdx++; renderReadingIntro(); }
        else {
          state.readingCeiling = pass ? text.level : (state.readingIdx > 0 ? READING[state.readingIdx - 1].level : "poniżej A2");
          startListening();
        }
      });
      app.appendChild(card);
    }

    // ---------- LISTENING ----------
    function startListening() { state.listeningIdx = 0; state.listeningAnswers = {}; state.listeningScores = []; renderListeningIntro(); }

    // Transkrypty dialogów zapisane są w formie "A: ... B: ... A: ...", żeby
    // było wiadomo, kto mówi, gdy ktoś czyta skrypt (patrz niżej). Syntezator
    // mowy nie powinien jednak czytać samych etykiet "A:"/"B:" na głos —
    // dlatego przed przekazaniem tekstu do speechSynthesis usuwamy je tutaj.
    function speechFriendlyText(transcript) {
      return transcript.replace(/(^|\s)[A-Z]:\s*/g, "$1").replace(/\s+/g, " ").trim();
    }

    // Do wyświetlenia w podglądzie tekstu (awaryjny przycisk "Pokaż tekst
    // nagrania") rozbijamy dialog na osobne linie, po jednej na wypowiedź —
    // monologi (bez etykiet "A:"/"B:") zostają jednym akapitem bez zmian.
    function transcriptToScriptHtml(transcript) {
      var withBreaks = transcript.replace(/ (?=[A-Z]: )/g, "\n");
      var lines = withBreaks.split("\n");
      return lines.map(function (line) {
        var m = line.match(/^([A-Z]):\s*(.*)$/);
        return m ? ("<strong>" + m[1] + ":</strong> " + m[2]) : line;
      }).join("<br>");
    }

    function speak(text) {
      try {
        if (!window.speechSynthesis) return false;
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(speechFriendlyText(text));
        u.lang = "en-US"; u.rate = 0.95;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }

    function renderListeningIntro() {
      var rec = LISTENING[state.listeningIdx];
      state.listeningPlayed = 0;
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Moduł 3 · Słuchanie ze zrozumieniem · nagranie " + (state.listeningIdx + 1) + "/3 · poziom docelowy " + rec.level));
      card.appendChild(el("h2", "h2-sm", rec.title));
      card.appendChild(el("p", "text-muted", "Kliknij „Odtwórz”, aby usłyszeć nagranie (możesz odtworzyć maksymalnie dwa razy). Tekst nie jest wyświetlany — tak jak w prawdziwym teście."));
      var row = el("div", "row");
      var playBtn = el("button", "btn btn-outline", "▶ Odtwórz nagranie"); playBtn.type = "button";
      var counter = el("span", "text-muted", "");
      if (!window.speechSynthesis) {
        card.appendChild(el("div", "admin-message is-error", "Twoja przeglądarka nie obsługuje syntezy mowy. Poproś lektora o przeczytanie treści na głos."));
      }
      playBtn.onclick = function () {
        if (state.listeningPlayed >= 2) return;
        if (speak(rec.transcript)) { state.listeningPlayed++; counter.textContent = "Odtworzono: " + state.listeningPlayed + "/2"; }
        if (state.listeningPlayed >= 2) playBtn.disabled = true;
      };
      row.appendChild(playBtn); row.appendChild(counter);
      card.appendChild(row);

      // Awaryjny podgląd tekstu — na wypadek, gdyby głos syntezatora mowy w
      // danej przeglądarce był zbyt słabej jakości, żeby dało się go zrozumieć.
      // Domyślnie ukryty, żeby nie zachęcać do pomijania samego słuchania.
      var scriptToggle = el("button", "btn btn-outline", "📄 Pokaż tekst nagrania"); scriptToggle.type = "button"; scriptToggle.style.marginTop = "14px";
      var scriptBox = el("div", "diag-script-box", transcriptToScriptHtml(rec.transcript)); scriptBox.style.display = "none";
      var scriptNote = el("p", "diag-script-note", "Użyj tylko, jeśli nagranie jest niesłyszalne albo niezrozumiałe (np. słaby głos syntezatora mowy w tej przeglądarce)."); scriptNote.style.display = "none";
      scriptToggle.onclick = function () {
        var showing = scriptBox.style.display !== "none";
        scriptBox.style.display = showing ? "none" : "block";
        scriptNote.style.display = showing ? "none" : "block";
        scriptToggle.textContent = showing ? "📄 Pokaż tekst nagrania" : "📄 Ukryj tekst nagrania";
      };
      card.appendChild(scriptToggle);
      card.appendChild(scriptNote);
      card.appendChild(scriptBox);

      var next = el("button", "btn btn-primary", "Przejdź do pytań →"); next.type = "button"; next.style.marginTop = "16px";
      next.onclick = renderListeningQuestions;
      card.appendChild(next);
      app.appendChild(card);
    }

    function renderListeningQuestions() {
      var rec = LISTENING[state.listeningIdx];
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Pytania do nagrania “" + rec.title + "”"));
      renderOpenOrChoice(card, rec.qs, function (answers) {
        var correct = scoreAnswers(rec.qs, answers);
        state.listeningAnswers[rec.id] = { answers: answers, correct: correct, total: rec.qs.length };
        state.listeningScores.push({ level: rec.level, pct: correct / rec.qs.length });
        var pass = (correct / rec.qs.length) >= 0.6;
        if (pass && state.listeningIdx < LISTENING.length - 1) { state.listeningIdx++; renderListeningIntro(); }
        else {
          state.listeningCeiling = pass ? rec.level : (state.listeningIdx > 0 ? LISTENING[state.listeningIdx - 1].level : "poniżej A2");
          startWriting();
        }
      });
      app.appendChild(card);
    }

    // ---------- WRITING ----------
    function startWriting() {
      var g = state.grammarCeiling;
      state.writingTask = (g === "A1" || g === "A2") ? "A" : "B";
      renderWriting();
    }

    function renderWriting() {
      var task = WRITING_TASKS[state.writingTask];
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Moduł 4 · Pisanie · " + task.label));
      card.appendChild(el("h2", "h2-sm", "Napisz odpowiedź"));
      card.appendChild(el("p", "text-muted", task.prompt));
      var ta = el("textarea"); ta.rows = 10;
      ta.oninput = function () { state.writingText = ta.value; };
      card.appendChild(ta);
      var submit = el("button", "btn btn-primary", "Zakończ pisanie →"); submit.type = "button"; submit.style.marginTop = "16px";
      submit.onclick = function () { state.writingText = ta.value; startSpeaking(); };
      card.appendChild(submit);
      app.appendChild(card);
    }

    // ---------- SPEAKING (prowadzone ręcznie przez lektora, na żywo) ----------
    var SPEAKING_CRITERIA = [
      { key: "fluency", label: "Płynność i spójność (Discourse Management)" },
      { key: "grammar", label: "Zakres i poprawność gramatyczna (Grammar)" },
      { key: "vocab", label: "Zakres słownictwa (Vocabulary)" },
      { key: "pron", label: "Wymowa (Pronunciation)" },
      { key: "interaction", label: "Interakcja (Interactive Communication)" }
    ];
    var BANDS = ["A1–A2", "B1", "B2", "C1–C2"];

    function startSpeaking() { renderSpeaking(); }

    function renderSpeaking() {
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Moduł 5 · Mówienie — rozmowa z lektorem (na żywo)"));
      card.appendChild(el("h2", "h2-sm", "Ten moduł przeprowadza człowiek"));
      card.appendChild(el("p", "text-muted", "Płynnej rozmowy nie da się rzetelnie ocenić bez żywego rozmówcy, więc ten moduł przeprowadza lektor. Struktura (4 rosnące trudnością części) i kryteria oceny są wzorowane na egzaminie ustnym Cambridge English. Zadawaj pytania z kolejnych części, aż kursant zacznie sobie nie radzić — wtedy zatrzymaj się i oceń poniżej."));
      SPEAKING_PARTS.forEach(function (p) {
        var pc = el("div"); pc.style.marginTop = "16px"; pc.style.paddingTop = "14px"; pc.style.borderTop = "1px dashed var(--color-border)";
        pc.appendChild(el("div", null, "<b>" + p.part + " · " + p.title + "</b> <span class=\"text-muted\">(" + p.level + ")</span>"));
        var ul = el("ul"); ul.style.margin = "8px 0 0"; ul.style.paddingLeft = "20px";
        p.qs.forEach(function (q) { ul.appendChild(el("li", null, q)); });
        pc.appendChild(ul);
        card.appendChild(pc);
      });
      var ratingHeader = el("h3", "text-strong", "Ocena"); ratingHeader.style.marginTop = "20px";
      card.appendChild(ratingHeader);
      SPEAKING_CRITERIA.forEach(function (c) {
        var row = el("div", "field"); row.style.marginTop = "12px";
        row.appendChild(el("label", null, c.label));
        var sel = el("select");
        sel.appendChild(el("option", null, "— nieoceniane —"));
        BANDS.forEach(function (b) { var o = el("option", null, b); o.value = b; sel.appendChild(o); });
        sel.value = state.speaking[c.key] || "";
        sel.onchange = function () { state.speaking[c.key] = sel.value; };
        row.appendChild(sel);
        card.appendChild(row);
      });
      var row2 = el("div", "row-wrap"); row2.style.gap = "10px"; row2.style.marginTop = "20px";
      var skip = el("button", "btn btn-outline", "Pomiń na razie →"); skip.type = "button";
      skip.onclick = function () { state.speaking.skipped = true; goToReport(); };
      var done = el("button", "btn btn-primary", "Zapisz i zobacz raport →"); done.type = "button";
      done.onclick = function () { goToReport(); };
      row2.appendChild(skip); row2.appendChild(done);
      card.appendChild(row2);
      app.appendChild(card);
    }

    // ---------- OCENA PISANIA + RAPORT ----------
    function goToReport() {
      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("h2", "h2-sm", "Liczę wynik…"));
      card.appendChild(el("p", "text-muted", "To może potrwać chwilę."));
      app.appendChild(card);
      tryGradeWriting(function () { renderReport(); });
    }

    function tryGradeWriting(cb) {
      // Automatyczna ocena AI działa tylko w środowisku, które ją udostępnia
      // (nie na zwykłej stronie WWW) — tutaj zawsze spadamy na ocenę ręczną
      // lektora, co i tak jest głównym, docelowym trybem tej strony.
      if (!state.writingText || !state.writingText.trim()) { state.writingResult = { status: "empty" }; return cb(); }
      state.writingResult = { status: "manual" };
      cb();
    }

    function buildChecklist() {
      var rows = [];
      LEVELS.forEach(function (lv) {
        var sectionDone = !!(state.grammar[lv] && state.grammar[lv]._score);
        BANK[lv].forEach(function (item) {
          var status = "N";
          if (sectionDone) status = (state.grammar[lv][item.code] === item.ans) ? "O" : "N";
          rows.push({ level: lv, code: item.code, tag: item.tag, kind: item.kind, status: status });
        });
      });
      return rows;
    }

    function speakingOverall() {
      var vals = SPEAKING_CRITERIA.map(function (c) { return state.speaking[c.key]; }).filter(Boolean);
      if (!vals.length) return null;
      var counts = {};
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
      var best = null, bestN = 0;
      Object.keys(counts).forEach(function (k) { if (counts[k] > bestN) { bestN = counts[k]; best = k; } });
      return best;
    }

    // ---------- POZIOM OGÓLNY (zbiorczy wynik wszystkich sprawności) ----------
    var LEVEL_BASE = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    var SPEAKING_BAND_NUMERIC = { "A1–A2": 2, "B1": 3, "B2": 4, "C1–C2": 5 };

    function subBandFromPct(pct) {
      if (pct >= 0.85) return 3;
      if (pct >= 0.65) return 2;
      return 1;
    }

    function numericFromLevelSub(level, sub) {
      var base = LEVEL_BASE[level];
      if (!base) return null;
      return base + (sub - 1) / 3;
    }

    function skillNumeric(levelStr, pct) {
      if (!levelStr) return null;
      if (levelStr.indexOf("poniżej") === 0) return 0.5;
      var sub = (pct != null) ? subBandFromPct(pct) : 2;
      return numericFromLevelSub(levelStr, sub);
    }

    function findScorePctForCeiling(scores, ceilingLevel) {
      if (!scores || !scores.length || !ceilingLevel) return null;
      for (var i = scores.length - 1; i >= 0; i--) {
        if (scores[i].level === ceilingLevel) return scores[i].pct;
      }
      return null;
    }

    function formatOverallLabel(avg) {
      if (avg < 1) return "poniżej A1";
      var base = Math.min(6, Math.floor(avg));
      var frac = avg - base;
      var sub = frac < (1 / 3) ? 1 : (frac < (2 / 3) ? 2 : 3);
      var levelName = "C2";
      Object.keys(LEVEL_BASE).forEach(function (k) { if (LEVEL_BASE[k] === base) levelName = k; });
      return levelName + "." + sub;
    }

    function computeOverallLevel() {
      var samples = [];

      if (state.grammarSubLevel) {
        if (state.grammarSubLevel.indexOf("poniżej") === 0) {
          samples.push({ numeric: 0.5, weight: 1.2, name: "Gramatyka" });
        } else {
          var gScore = state.grammar[state.grammarSubLevel] && state.grammar[state.grammarSubLevel]._score;
          var gPct = (gScore && gScore.gTotal > 0) ? gScore.gCorrect / gScore.gTotal : null;
          var nG = skillNumeric(state.grammarSubLevel, gPct);
          if (nG != null) samples.push({ numeric: nG, weight: 1.2, name: "Gramatyka" });
        }
      }

      if (state.vocabSubLevel) {
        if (state.vocabSubLevel.indexOf("poniżej") === 0) {
          samples.push({ numeric: 0.5, weight: 1, name: "Słownictwo" });
        } else {
          var vScore = state.grammar[state.vocabSubLevel] && state.grammar[state.vocabSubLevel]._score;
          var vPct = (vScore && vScore.vTotal > 0) ? vScore.vCorrect / vScore.vTotal : null;
          var nV = skillNumeric(state.vocabSubLevel, vPct);
          if (nV != null) samples.push({ numeric: nV, weight: 1, name: "Słownictwo" });
        }
      }

      if (state.readingCeiling) {
        if (state.readingCeiling.indexOf("poniżej") === 0) {
          samples.push({ numeric: 0.5, weight: 1, name: "Czytanie" });
        } else {
          var rPct = findScorePctForCeiling(state.readingScores, state.readingCeiling);
          var nR = skillNumeric(state.readingCeiling, rPct);
          if (nR != null) samples.push({ numeric: nR, weight: 1, name: "Czytanie" });
        }
      }

      if (state.listeningCeiling) {
        if (state.listeningCeiling.indexOf("poniżej") === 0) {
          samples.push({ numeric: 0.5, weight: 1, name: "Słuchanie" });
        } else {
          var lPct = findScorePctForCeiling(state.listeningScores, state.listeningCeiling);
          var nL = skillNumeric(state.listeningCeiling, lPct);
          if (nL != null) samples.push({ numeric: nL, weight: 1, name: "Słuchanie" });
        }
      }

      var spBand = speakingOverall();
      if (spBand && SPEAKING_BAND_NUMERIC[spBand] != null) {
        var spLevelKey = Object.keys(LEVEL_BASE).filter(function (k) { return LEVEL_BASE[k] === SPEAKING_BAND_NUMERIC[spBand]; })[0];
        samples.push({ numeric: numericFromLevelSub(spLevelKey, 2), weight: 1, name: "Mówienie" });
      }

      if (!samples.length) return null;
      var totalW = 0, sum = 0;
      samples.forEach(function (s) { sum += s.numeric * s.weight; totalW += s.weight; });
      var avg = sum / totalW;
      return { avg: avg, samples: samples, label: formatOverallLabel(avg) };
    }

    function slug(s) { return (s || "kursant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "kursant"; }

    function downloadReport(text) {
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "wynik-" + slug(state.name) + ".txt";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function buildReportText(checklist, strengths, gaps) {
      var lines = [];
      var ov = computeOverallLevel();
      lines.push("PROFIL POZIOMU KURSANTA (" + CONTENT.testLabel + ")");
      lines.push("Imię i nazwisko: " + state.name);
      lines.push("Data: " + new Date().toISOString().slice(0, 10));
      lines.push("");
      lines.push("POZIOM OGÓLNY (wszystkie zbadane sprawności): " + (ov ? ov.label : "niedostępny — za mało danych"));
      lines.push("");
      lines.push("POZIOM WG SPRAWNOŚCI");
      lines.push("Gramatyka: " + state.grammarSubLevel);
      lines.push("Słownictwo: " + state.vocabSubLevel);
      lines.push("Czytanie: " + state.readingCeiling);
      lines.push("Słuchanie: " + state.listeningCeiling);
      lines.push("Pisanie: do oceny lektora");
      lines.push("Mówienie: " + (speakingOverall() || "do przeprowadzenia przez lektora"));
      lines.push("");
      lines.push("MOCNE STRONY:");
      strengths.forEach(function (r) { lines.push("- " + r.tag + " (" + r.code + ")"); });
      lines.push("");
      lines.push("BRAKI DO UZUPEŁNIENIA:");
      gaps.forEach(function (r) { lines.push("- " + r.tag + " (" + r.code + ")"); });
      lines.push("");
      lines.push("ODPOWIEDŹ PISEMNA KURSANTA:");
      lines.push(state.writingText || "(brak)");
      return lines.join("\n");
    }

    function saveResultToDb(checklist) {
      var payload = {
        code: accessCode,
        student_name: state.name,
        test_type: CONTENT.testType,
        levels: {
          grammar: state.grammarSubLevel, vocabulary: state.vocabSubLevel,
          reading: state.readingCeiling, listening: state.listeningCeiling,
          writing: null, speaking: speakingOverall()
        },
        writing_text: state.writingText || "",
        writing_ai: null,
        checklist: checklist,
        speaking_detail: state.speaking,
        report_text: state.reportText
      };
      return client.from('diagnosis_results').insert(payload);
    }

    function renderReport() {
      var checklist = buildChecklist();
      var strengths = checklist.filter(function (r) { return r.level === state.grammarCeiling && r.status === "O"; }).slice(0, 6);
      var ceilingIdx = LEVELS.indexOf(state.grammarCeiling);
      var gaps = checklist.filter(function (r) { return r.status === "N"; });
      gaps.sort(function (a, b) { return Math.abs(LEVELS.indexOf(a.level) - ceilingIdx) - Math.abs(LEVELS.indexOf(b.level) - ceilingIdx); });
      gaps = gaps.slice(0, 6);

      app.innerHTML = "";
      var card = el("div", "card");
      card.appendChild(el("div", "eyebrow", "Raport końcowy · " + state.name + " · " + CONTENT.testLabel));
      card.appendChild(el("h1", "h2-sm", "Profil poziomu"));

      var ov = computeOverallLevel();
      var ovBox = el("div", "admin-message is-success"); ovBox.style.marginTop = "12px";
      if (ov) {
        ovBox.innerHTML = "<b style=\"font-size:18px\">Poziom ogólny: " + ov.label + "</b><br>" +
          "Wynik zbiorczy wyliczony na podstawie wszystkich zbadanych sprawności (" + ov.samples.map(function (s) { return s.name; }).join(", ") + "). " +
          "Zapis [poziom].[podpoziom] — .1 = dolna granica poziomu, .2 = środek, .3 = górna granica, blisko następnego poziomu.";
      } else {
        ovBox.innerHTML = "<b>Poziom ogólny: niedostępny</b><br>Za mało zebranych danych, aby wyliczyć wynik zbiorczy.";
      }
      card.appendChild(ovBox);

      var skills = [
        { label: "Gramatyka", level: state.grammarSubLevel },
        { label: "Słownictwo", level: state.vocabSubLevel },
        { label: "Czytanie", level: state.readingCeiling },
        { label: "Słuchanie", level: state.listeningCeiling },
        { label: "Pisanie", level: "do oceny lektora" },
        { label: "Mówienie", level: speakingOverall() || "do przeprowadzenia" }
      ];
      var skillWrap = el("div"); skillWrap.style.marginTop = "10px";
      skills.forEach(function (s) {
        var row = el("div", "diag-skill-row");
        row.appendChild(el("div", null, "<b>" + s.label + "</b>"));
        var track = el("div", "diag-skill-track");
        var validLevel = LEVELS.indexOf(s.level) > -1;
        if (validLevel) {
          var fill = el("div", "diag-skill-fill");
          fill.style.width = (((LEVELS.indexOf(s.level) + 1) / LEVELS.length) * 100) + "%";
          fill.style.background = LVL_COLOR[s.level];
          track.appendChild(fill);
        }
        row.appendChild(track);
        row.appendChild(validLevel ? levelChip(s.level) : (function () { var c = el("span", "diag-chip", s.level); c.style.background = "var(--color-ink-soft)"; return c; })());
        skillWrap.appendChild(row);
      });
      card.appendChild(skillWrap);
      app.appendChild(card);

      var card2 = el("div", "card");
      card2.appendChild(el("h3", "text-strong", "Mocne strony i priorytetowe braki"));
      var cols = el("div", "grid grid-2"); cols.style.gap = "18px";
      var strCol = el("div");
      strCol.appendChild(el("div", null, "<b style=\"color:var(--color-accent)\">Opanowane</b>"));
      strengths.forEach(function (r) { strCol.appendChild(el("div", "text-muted", "✓ " + r.tag + " (" + r.code + ")")); });
      if (!strengths.length) strCol.appendChild(el("div", "text-muted", "(brak danych na tym poziomie)"));
      var gapCol = el("div");
      gapCol.appendChild(el("div", null, "<b>Do uzupełnienia</b>"));
      gaps.forEach(function (r) { gapCol.appendChild(el("div", "text-muted", "✗ " + r.tag + " (" + r.code + ")")); });
      cols.appendChild(strCol); cols.appendChild(gapCol);
      card2.appendChild(cols);
      app.appendChild(card2);

      var card3 = el("div", "card");
      card3.appendChild(el("h3", "text-strong", "Pisanie — szczegóły"));
      card3.appendChild(el("p", "text-muted", "<i>Zadanie: " + WRITING_TASKS[state.writingTask].prompt + "</i>"));
      var wrTa = el("textarea"); wrTa.readOnly = true; wrTa.rows = 6; wrTa.value = state.writingText || "(brak odpowiedzi)";
      card3.appendChild(wrTa);
      card3.appendChild(el("div", "admin-message is-success", "Odpowiedź czeka na ręczną ocenę lektora wg rubryki z dokumentu referencyjnego."));
      app.appendChild(card3);

      var card4 = el("div", "card");
      card4.appendChild(el("h3", "text-strong", "Pełna macierz „zna / nie zna”"));
      LEVELS.forEach(function (lv) {
        var det = el("details", "diag-lvl");
        var sum = el("summary");
        sum.appendChild(levelChip(lv));
        var doneCount = checklist.filter(function (r) { return r.level === lv && r.status === "O"; }).length;
        var totalCount = checklist.filter(function (r) { return r.level === lv; }).length;
        sum.appendChild(el("span", null, " " + doneCount + "/" + totalCount + " opanowane"));
        det.appendChild(sum);
        checklist.filter(function (r) { return r.level === lv; }).forEach(function (r) {
          var ir = el("div", "diag-item-row");
          var dot = el("span", "diag-status-dot"); dot.style.background = r.status === "O" ? "var(--color-accent)" : "var(--color-ink)";
          var left = el("div"); left.style.display = "flex"; left.style.gap = "8px"; left.style.alignItems = "flex-start";
          left.appendChild(dot); left.appendChild(el("span", null, r.tag));
          ir.appendChild(left); ir.appendChild(el("span", "text-muted", r.code));
          det.appendChild(ir);
        });
        card4.appendChild(det);
      });
      app.appendChild(card4);

      var card4b = el("div", "card");
      var refDet = el("details", "diag-lvl");
      refDet.appendChild(el("summary", null, "Odniesienie do IELTS / TOEFL / Cambridge"));
      var refInner = el("div"); refInner.style.padding = "10px 0 0";
      refInner.appendChild(renderConcordanceTable());
      refDet.appendChild(refInner);
      card4b.appendChild(refDet);
      app.appendChild(card4b);

      var card5 = el("div", "card");
      card5.appendChild(el("h3", "text-strong", "Wynik i przekazanie do lektora"));
      var reportText = buildReportText(checklist, strengths, gaps);
      state.reportText = reportText;

      var saveNotice = el("div", "admin-message is-success", "Zapisuję wynik…");
      card5.appendChild(saveNotice);

      saveResultToDb(checklist).then(function (res) {
        if (res.error) {
          saveNotice.className = "admin-message is-error";
          saveNotice.textContent = "Nie udało się automatycznie zapisać wyniku. Pobierz raport poniżej i wyślij go swojemu lektorowi ręcznie, na wszelki wypadek.";
        } else {
          saveNotice.className = "admin-message is-success";
          saveNotice.textContent = "Wynik zapisany i widoczny dla Twojego lektora. Możesz też pobrać go dla siebie poniżej.";
        }
      }).catch(function () {
        saveNotice.className = "admin-message is-error";
        saveNotice.textContent = "Nie udało się automatycznie zapisać wyniku. Pobierz raport poniżej i wyślij go swojemu lektorowi ręcznie, na wszelki wypadek.";
      });

      var row = el("div", "row-wrap"); row.style.gap = "10px"; row.style.marginTop = "12px";
      var dlBtn = el("button", "btn btn-primary", "⬇ Pobierz raport (.txt)"); dlBtn.type = "button";
      dlBtn.onclick = function () { downloadReport(reportText); };
      var cpBtn = el("button", "btn btn-outline", "Kopiuj do schowka"); cpBtn.type = "button";
      cpBtn.onclick = function () {
        try { navigator.clipboard && navigator.clipboard.writeText(reportText); cpBtn.textContent = "Skopiowano ✓"; } catch (e) {}
      };
      row.appendChild(dlBtn); row.appendChild(cpBtn);
      card5.appendChild(row);
      var ta = el("textarea"); ta.rows = 8; ta.style.marginTop = "14px"; ta.readOnly = true; ta.value = reportText;
      card5.appendChild(ta);
      card5.appendChild(el("p", "text-muted", "<small>Ten wynik zapisał się automatycznie — możesz go później znów zobaczyć (razem z innymi swoimi testami i nadchodzącymi zajęciami) w <a href=\"panel-kursanta.html\" class=\"btn-link\">panelu kursanta</a>, logując się tym samym kodem dostępu.</small>"));
      app.appendChild(card5);
    }

    renderStart();
  }
});
