/* ==========================================================================
   OwnEnglish — Diagnoza pogłębiona — treść testu BIZNESOWEGO
   Ta sama silnikowa logika (js/diagnoza-engine.js) obsługuje ten test i test
   ogólny (js/diagnoza-content-general.js) — różni je tylko treść pytań,
   tekstów i tematów niżej.
   ========================================================================== */

window.DIAGNOZA_BUSINESS = (function () {
  function it(code, level, kind, tag, prompt, opts, ans) {
    return { code: code, level: level, kind: kind, tag: tag, prompt: prompt, opts: opts, ans: ans };
  }

  var BANK = {
    A1: [
      it("G-A1-01", "A1", "g", "Czasownik “to be”", "The new office ___ in the city centre.", ["is", "are", "am"], 0),
      it("G-A1-02", "A1", "g", "Present Simple (3.os. -s)", "Our accountant ___ (check) the invoices every Friday.", ["check", "checks", "checking"], 1),
      it("G-A1-03", "A1", "g", "Present Simple — przeczenia", "The clients ___ arrive until 3 p.m.", ["doesn't", "don't", "not"], 1),
      it("G-A1-04", "A1", "g", "Przymiotniki dzierżawcze / 's", "This is Mr. Kowalski. ___ office is on the third floor.", ["He", "His", "Him"], 1),
      it("G-A1-05", "A1", "g", "Liczba mnoga rzeczowników", "We are hiring three new ___ this month.", ["employee", "employees", "employes"], 1),
      it("G-A1-06", "A1", "g", "There is / There are", "___ a meeting room on the second floor.", ["There is", "There are", "It is"], 0),
      it("V-A1-01", "A1", "v", "Podstawowe słownictwo biurowe", "Where do you usually have lunch? — In the staff ___.", ["canteen", "warehouse", "garden"], 0),
      it("V-A1-02", "A1", "v", "Stanowiska w firmie", "The person who leads a team of employees is the ___.", ["client", "manager", "visitor"], 1),
      it("V-A1-03", "A1", "v", "Podstawowe czynności biurowe", "I always ___ my emails before I leave the office.", ["make", "check", "do"], 1),
      it("V-A1-04", "A1", "v", "Rzeczowniki biurowe", "Choose the word that does NOT belong: invoice, stapler, printer, banana", ["banana", "invoice", "printer"], 0)
    ],
    A2: [
      it("G-A2-01", "A2", "g", "Past Simple", "Yesterday, the manager ___ a new marketing plan to the team.", ["present", "presented", "presenting"], 1),
      it("G-A2-02", "A2", "g", "Present Continuous", "Please be quiet — the director ___ (talk) on the phone right now.", ["talks", "is talking", "talk"], 1),
      it("G-A2-03", "A2", "g", "Stopniowanie przymiotników", "This quarter's sales figures are ___ than last year's. (good)", ["gooder", "better", "best"], 1),
      it("G-A2-04", "A2", "g", "Czas przyszły “going to”", "We've already signed the contract, so we ___ start the project next Monday.", ["are going to", "will", "going"], 0),
      it("G-A2-05", "A2", "g", "have to / don't have to", "You ___ book a meeting room in advance — it's company policy.", ["don't have to", "have to", "can"], 1),
      it("G-A2-06", "A2", "g", "some/any/much/many", "There isn't ___ budget left for this project this year.", ["many", "any", "some"], 1),
      it("V-A2-01", "A2", "v", "Umawianie spotkań", "Can we ___ a meeting for Thursday afternoon?", ["do", "schedule", "take"], 1),
      it("V-A2-02", "A2", "v", "Korespondencja biznesowa", "I'm writing to ___ the delivery date we discussed.", ["confirm", "confess", "conform"], 0),
      it("V-A2-03", "A2", "v", "Opis miejsca pracy", "The new office is very ___ — everyone has their own desk and good lighting.", ["crowded", "spacious", "noisy"], 1),
      it("V-A2-04", "A2", "v", "Uczucia związane z pracą", "I felt really ___ when the client cancelled the order at the last minute.", ["relieved", "frustrated", "proud"], 1)
    ],
    B1: [
      it("G-B1-01", "B1", "g", "Present Perfect vs Past Simple", "I ___ never ___ (work) with such a difficult client before, but yesterday I finally understood how to handle it.", ["have / worked", "did / work", "am / working"], 0),
      it("G-B1-02", "B1", "g", "Past Continuous", "While the team ___ (prepare) the presentation, the client called to reschedule.", ["prepared", "was preparing", "prepare"], 1),
      it("G-B1-03", "B1", "g", "First Conditional", "If the supplier ___ the goods on time, we'll miss the launch date.", ["doesn't deliver", "won't deliver", "didn't deliver"], 0),
      it("G-B1-04", "B1", "g", "Strona bierna — czasy proste", "The new policy ___ (introduce) last month.", ["was introduced", "introduced", "has introduce"], 0),
      it("G-B1-05", "B1", "g", "Zdania względne definiujące", "The client ___ placed the biggest order this year is visiting our office tomorrow.", ["which", "who", "whose"], 1),
      it("G-B1-06", "B1", "g", "Modalne przewidywania", "I'm not sure, but sales ___ increase next quarter if the campaign works.", ["are going to", "will", "might"], 2),
      it("V-B1-01", "B1", "v", "Phrasal verbs biznesowe", "The company had to ___ down one of its factories due to low demand.", ["shut", "close up", "shut off"], 0),
      it("V-B1-02", "B1", "v", "Kolokacje make/do", "We need to ___ a decision about the new supplier by Friday.", ["do", "make", "have"], 1),
      it("V-B1-03", "B1", "v", "Kariera i awans", "She was recently ___ to senior manager after five years with the company.", ["promoted", "fired", "hired"], 0),
      it("V-B1-04", "B1", "v", "Problemy w pracy", "There's been a ___ in communication between the two departments.", ["breakdown", "breakthrough", "backup"], 0)
    ],
    B2: [
      it("G-B2-01", "B2", "g", "Second Conditional", "If we ___ a bigger budget, we would launch the campaign internationally.", ["had", "have", "would have"], 0),
      it("G-B2-02", "B2", "g", "Third Conditional", "If the team ___ harder, they would have met the deadline.", ["worked", "had worked", "has worked"], 1),
      it("G-B2-03", "B2", "g", "Past Perfect Continuous", "By the time the CEO arrived, we ___ (wait) for almost two hours.", ["waited", "was waiting", "had been waiting"], 2),
      it("G-B2-04", "B2", "g", "Mowa zależna", "The client said that they ___ the contract by the end of the week. (“We will sign the contract by the end of the week.”)", ["will sign", "would sign", "sign"], 1),
      it("G-B2-05", "B2", "g", "Modalne dedukcji", "He hasn't replied to any emails today — he ___ be out of the office.", ["must", "can", "should"], 0),
      it("G-B2-06", "B2", "g", "wish / if only", "I wish I ___ more about finance before I took this job.", ["know", "knew", "had known"], 1),
      it("V-B2-01", "B2", "v", "Phrasal verbs biznesowe", "The board decided to ___ out the new product line across all regions.", ["roll", "run", "ring"], 0),
      it("V-B2-02", "B2", "v", "Słowotwórstwo", "The quarterly results were ___ — even the board was surprised.", ["disappointing", "disappointed", "disappoint"], 0),
      it("V-B2-03", "B2", "v", "Gerundium po przyimku", "Despite ___ (offer) a lower price, the supplier lost the contract.", ["offering", "to offer", "offered"], 0),
      it("V-B2-04", "B2", "v", "Rozróżnianie bliskoznaczników", "We need to come up with a new ___ to cut production costs.", ["strategy", "strategic", "strategist"], 0)
    ],
    C1: [
      it("G-C1-01", "C1", "g", "Inwersja dla podkreślenia", "___ had the merger been announced than the share price began to rise.", ["No sooner", "As soon as", "Hardly"], 0),
      it("G-C1-02", "C1", "g", "Zdania warunkowe mieszane", "If the company had invested in R&D earlier, it ___ a market leader today.", ["would be", "would have been", "will be"], 0),
      it("G-C1-03", "C1", "g", "Zdania rozszczepione", "It was only after the board meeting ___ realised the scale of the problem.", ["that we", "when we", "we"], 0),
      it("G-C1-04", "C1", "g", "Konstrukcja “have something done”", "We had the whole office ___ over the weekend.", ["renovate", "renovated", "to renovate"], 1),
      it("G-C1-05", "C1", "g", "Inwersja dla podkreślenia", "Not only ___ the deadline, but the quality of the report was also poor.", ["we missed", "did we miss", "we did miss"], 1),
      it("G-C1-06", "C1", "g", "Imiesłowowe równoważniki zdań", "Having reviewed all the proposals, ___ decided to go with the local supplier.", ["the committee", "it", "which"], 0),
      it("V-C1-01", "C1", "v", "Kolokacje abstrakcyjne", "After months of tense negotiations, both sides finally reached a ___.", ["breakthrough", "breakdown", "outbreak"], 0),
      it("V-C1-02", "C1", "v", "Precyzyjne przymiotniki oceniające", "The CFO's forecast, while optimistic, was fundamentally ___.", ["flawed", "flawless", "flawing"], 0),
      it("V-C1-03", "C1", "v", "Idiomy dot. zdolności", "She has a real ___ for spotting profitable opportunities.", ["knack", "present", "skillset"], 0),
      it("V-C1-04", "C1", "v", "Słownictwo formalne/akademickie", "The new regulation is likely to have far-reaching ___ for small businesses.", ["implications", "implementations", "applications"], 0)
    ],
    C2: [
      it("G-C2-01", "C2", "g", "Formalne łączniki koncesywne", "___ the economic downturn, the company managed to increase its market share.", ["Despite of", "Notwithstanding", "Although of"], 1),
      it("G-C2-02", "C2", "g", "Tryb łączący (subjunctive)", "The board insists that the CEO ___ present at every quarterly review.", ["is", "be", "will be"], 1),
      it("G-C2-03", "C2", "g", "Inwersja w rejestrze formalnym", "Rarely ___ such a rapid turnaround in a company's fortunes.", ["we have seen", "have we seen", "we saw"], 1),
      it("G-C2-04", "C2", "g", "Precyzyjne rozumienie niuansów", "Choose the option closest in meaning to: “The CEO didn't so much resign as get pushed out.”", ["She resigned entirely on her own terms.", "She was effectively forced to leave, though officially it looked voluntary.", "She was promoted."], 1),
      it("V-C2-01", "C2", "v", "Rejestr formalny vs neutralny", "Formal report style — which fits best? “The figures ___ our initial projections.”", ["back up", "corroborate", "prove right"], 1),
      it("V-C2-02", "C2", "v", "Subtelne niuanse znaczeniowe", "Choose the word closest in nuance to “meticulous” in a performance review context:", ["careless", "painstaking", "quick"], 1),
      it("V-C2-03", "C2", "v", "Idiomy o niejednoznacznym wydźwięku", "“He was somewhat disingenuous during the negotiation” means he was:", ["completely honest", "not entirely sincere", "very confused"], 1),
      it("V-C2-04", "C2", "v", "Konotacje bliskoznaczników", "Which pair are true synonyms with almost no difference in connotation, in a business context?", ["frugal / stingy", "adamant / resolute", "ruthless / efficient"], 1)
    ]
  };

  var READING = [
    { id: "R-A2", level: "A2", title: "My First Week at Global Trade Ltd.",
      text: "Last Monday, Tom started his new job at Global Trade Ltd. He usually arrives at the office at eight o'clock, before most of his colleagues. On his first day, his manager, Mrs. Adams, showed him around the building and introduced him to the sales team. Tom's desk is near the window, and he shares an office with two other assistants. Every morning, he checks his emails and prepares a short list of tasks for the day. He also ordered some new supplies for his desk — a stapler, a notebook, and a new office chair. After work, Tom usually has a coffee with his colleague Peter before taking the bus home. Tom says he likes his new job because the team is friendly and his manager always explains things clearly.",
      qs: [
        { q: "What time does Tom usually arrive at the office?", opts: ["Seven o'clock", "Eight o'clock", "Nine o'clock"], ans: 1 },
        { q: "Who showed Tom around the building?", opts: ["Peter", "Mrs. Adams", "a security guard"], ans: 1 },
        { q: "What does Tom do every morning?", opts: ["He calls clients", "He checks emails and plans his tasks", "He cleans his desk"], ans: 1 },
        { q: "True or False: Tom has his own private office.", opts: ["True", "False"], ans: 1 },
        { q: "Why does Tom like his new job? (own words, 1 sentence)", open: true, kw: ["friendly", "explains", "clearly", "team"] }
      ] },
    { id: "R-B", level: "B1/B2", title: "Negotiating with a New Supplier",
      text: "When Anna's company decided to switch to a new packaging supplier, she expected the negotiation to be straightforward — after all, the new supplier had offered a lower price from the very first email. In practice, it turned out to be far more complicated. The supplier's initial quote didn't include delivery costs, and once those were added, the savings looked much smaller. Anna also discovered that the new supplier required a minimum order size that was almost double what her company usually purchased, which meant tying up more cash in stock than she was comfortable with. Rather than accepting the first offer or walking away, Anna arranged a call to discuss the terms directly, and after some back-and-forth, the two sides agreed on a smaller trial order with a review after three months. Her manager later admitted he hadn't expected her to push back on the numbers, but was glad she had — the final deal, while less dramatic than the original offer, was considerably more realistic for the business.",
      qs: [
        { q: "Why did Anna's company want to switch suppliers?", opts: ["The old supplier was unreliable", "The new supplier offered a lower price", "The old supplier closed down"], ans: 1 },
        { q: "What problem did Anna find with the initial quote?", opts: ["It didn't include delivery costs", "It was written in the wrong currency", "It arrived too late"], ans: 0 },
        { q: "What does “tying up cash” mean in this context?", opts: ["saving money for later", "having money locked into stock instead of available", "spending money on marketing"], ans: 1 },
        { q: "What did Anna and the supplier finally agree on?", opts: ["cancelling the deal completely", "a smaller trial order with a review later", "doubling the original order"], ans: 1 },
        { q: "How did Anna's manager react to what she did? Justify briefly.", open: true, kw: ["glad", "didn't expect", "push back", "realistic"] }
      ] },
    { id: "R-C1", level: "C1", title: "The Myth of the Natural Negotiator",
      text: "Popular business culture likes to imagine the ideal negotiator as someone blessed with an almost innate charisma — quick-witted, persuasive, utterly comfortable under pressure. Decades of research into negotiation, however, tell a rather different and, for most of us, more encouraging story. What consistently separates strong negotiators from weak ones is not some inborn gift for charm but preparation: a clear sense of one's own priorities, a realistic read on the other side's constraints, and a willingness to walk away from a deal that doesn't meet a predefined threshold. Charisma, it turns out, can even work against a negotiator when it tips into overconfidence, leading them to underestimate the other party or to concede too quickly for the sake of maintaining rapport. Some of the most consistently effective negotiators studied were, if anything, notably understated in manner, relying on detailed research and patient questioning rather than force of personality. This has obvious implications for how companies train staff: rather than searching for naturally “gifted” negotiators, organisations would likely do better investing in structured preparation and rehearsal, skills that can be taught to almost anyone willing to put in the work.",
      qs: [
        { q: "According to the text, what does research suggest actually separates strong negotiators from weak ones?", opts: ["natural charisma", "careful preparation", "physical confidence"], ans: 1 },
        { q: "What surprising drawback of charisma does the text mention?", opts: ["it makes negotiators dishonest", "it can lead to overconfidence and quick concessions", "it slows down the negotiation process"], ans: 1 },
        { q: "What is implied by the phrase “more encouraging story” in the second sentence?", opts: ["the finding is worse news than expected", "the finding suggests negotiation skill can be learned, not just inherited", "the finding is irrelevant to most people"], ans: 1 },
        { q: "How were some of the most effective negotiators in the studies described?", opts: ["loud and highly charismatic", "notably understated, relying on research and questioning", "aggressive and unpredictable"], ans: 1 },
        { q: "What does the author recommend companies do differently when training staff?", open: true, kw: ["structured preparation", "rehearsal", "taught", "train"] }
      ] }
  ];

  var LISTENING = [
    { id: "L-A2", level: "A2", title: "At Reception",
      transcript: "A: Good morning, welcome to Bright Solutions. How can I help you? B: Good morning. I have a meeting with Mr. Novak at ten o'clock. A: Of course, what's your name, please? B: My name is Peter Wilson, from Delta Logistics. A: Thank you, Mr. Wilson. Please take a seat — I'll call Mr. Novak now. Would you like a coffee or some water while you wait? B: A coffee would be great, thank you. A: No problem. Mr. Novak will come down to meet you in about five minutes.",
      qs: [
        { q: "What time is Peter's meeting?", opts: ["Nine o'clock", "Ten o'clock", "Eleven o'clock"], ans: 1 },
        { q: "Who is Peter meeting?", opts: ["Mr. Wilson", "Mr. Novak", "the receptionist"], ans: 1 },
        { q: "Which company does Peter work for?", opts: ["Bright Solutions", "Delta Logistics", "neither is mentioned"], ans: 1 },
        { q: "What does Peter ask for while he waits?", opts: ["water", "tea", "coffee"], ans: 2 },
        { q: "True or False: Mr. Novak is already waiting in reception.", opts: ["True", "False"], ans: 1 }
      ] },
    { id: "L-B", level: "B1/B2", title: "Managing a Small Team",
      transcript: "So I've been managing a team of six people for about three years now, and honestly, the hardest part was never the technical side of the job — it was learning how to delegate properly. In the beginning, I was checking every single piece of work myself, and I ended up working longer hours than anyone on my team. I quickly realised that wasn't sustainable, so about a year in, I started giving people clear ownership of specific projects instead of just tasks. That changed everything. These days I spend most of my time on planning and removing obstacles for the team, while they handle the day-to-day work themselves. If I could give one piece of advice to a new manager, it would be: don't be afraid to trust people with real responsibility earlier than feels comfortable.",
      qs: [
        { q: "How long has the speaker been managing the team?", opts: ["one year", "three years", "ten years"], ans: 1 },
        { q: "What was the hardest part, according to the speaker?", opts: ["the technical work", "learning to delegate", "hiring new staff"], ans: 1 },
        { q: "What change did the speaker make about a year in?", opts: ["hired more staff", "gave people ownership of projects", "reduced the team size"], ans: 1 },
        { q: "What does the speaker mostly do now?", opts: ["checking every piece of work personally", "planning and removing obstacles for the team", "doing the team's tasks himself"], ans: 1 },
        { q: "What advice does the speaker give? (own words)", open: true, kw: ["trust", "responsibility", "earlier"] }
      ] },
    { id: "L-C1", level: "C1", title: "On Leadership Under Pressure",
      transcript: "One thing that's often misunderstood about leadership is the assumption that the best decisions get made under intense pressure — the classic image of the crisis that forces a leader to rise to the occasion. In reality, the research paints a more nuanced picture. Moderate pressure can occasionally sharpen focus and cut through unnecessary debate, but sustained or extreme pressure tends to narrow people's thinking rather than expand it — leaders fall back on familiar, well-rehearsed responses instead of genuinely evaluating the situation in front of them. What seems to matter far more than pressure itself is a sense of psychological safety within the team: people are more willing to raise inconvenient facts or propose unconventional solutions when they're confident that doing so won't be held against them later. Organisations that claim to want bold decision-making but quietly punish those who admit mistakes are, in effect, undermining their own stated goals.",
      qs: [
        { q: "What common assumption about leadership does the speaker challenge?", opts: ["that leadership needs training", "that pressure improves decision-making", "that leadership cannot be measured"], ans: 1 },
        { q: "According to the speaker, what does sustained extreme pressure do to leaders' thinking?", opts: ["it broadens it", "it narrows it", "it has no effect"], ans: 1 },
        { q: "What factor does the speaker say matters more than pressure?", opts: ["financial reward", "psychological safety", "team size"], ans: 1 },
        { q: "What contradiction does the speaker point out about some organisations?", opts: ["they claim to want bold decisions but punish honesty about mistakes", "they claim to punish mistakes but reward them", "they claim to have no rules but enforce many"], ans: 0 },
        { q: "In your own words, what is the speaker's main argument?", open: true, kw: ["psychological safety", "pressure", "mistakes"] }
      ] }
  ];

  var WRITING_TASKS = {
    A: { label: "Zadanie A (A1–A2)", prompt: "Write a short email to a colleague. Say what time you will arrive at the office tomorrow, what you need to prepare for the meeting, and ask them to bring the sales report. (50–80 words)" },
    B: { label: "Zadanie B (B1–C1) · format zbliżony do raportu biznesowego Cambridge English Business / IELTS Writing Task 2", prompt: "You work for a company that is considering switching to a new software supplier. Write a short report to your manager. Include: (1) the main problems with the current supplier, (2) the advantages and disadvantages of switching, and (3) your recommendation, with reasons. (150–220 words)" }
  };

  var SPEAKING_PARTS = [
    { part: "Część 1", level: "A1–A2", title: "Rozmowa wstępna (interview)",
      qs: ["What's your name? What company do you work for?", "What do you do at work? What are your main responsibilities?", "How do you usually travel to work?", "What do you like most about your job?"] },
    { part: "Część 2", level: "B1", title: "Długa wypowiedź bez przerywania (long turn, ok. 1 min)",
      qs: ["Describe a typical working day in your job, from when you arrive to when you leave.", "Tell me about a project you worked on recently. What was it, and what was your role?"] },
    { part: "Część 3", level: "B2", title: "Opinia i porównanie",
      qs: ["What do you think are the advantages and disadvantages of working in a large company compared to a small one?", "How has technology changed the way people do business over the last ten years?"] },
    { part: "Część 4", level: "C1–C2", title: "Dyskusja abstrakcyjna",
      qs: ["To what extent do you think globalisation has been good or bad for small businesses?", "Some people say the best leaders are born, not made. What's your view, and why?"] }
  ];

  return {
    testType: "biznesowy",
    testLabel: "Test biznesowy",
    copy: {
      eyebrow: "Diagnoza poziomu · angielski biznesowy",
      title: "Dokładny test poziomujący z angielskiego biznesowego.",
      intro: "Ten test składa się z kilku krótkich części: gramatyka i słownictwo, czytanie, słuchanie i pisanie — wszystkie oparte na sytuacjach biznesowych (maile, spotkania, negocjacje, raporty). Każda część zaczyna się łatwo i staje się trudniejsza — test zatrzyma się sam, gdy dojdziesz do swojej granicy, więc nie zniechęcaj się, jeśli w pewnym momencie zrobi się trudno. To dobry znak, nie zły. Zajmie to około 40–60 minut. Na końcu automatycznie zapiszemy Twój wynik i przekażemy go Twojemu lektorowi."
    },
    BANK: BANK,
    READING: READING,
    LISTENING: LISTENING,
    WRITING_TASKS: WRITING_TASKS,
    SPEAKING_PARTS: SPEAKING_PARTS
  };
})();
