/* ==========================================================================
   OwnEnglish — Diagnoza pogłębiona — treść testu OGÓLNEGO
   Ta sama silnikowa logika (js/diagnoza-engine.js) obsługuje ten test i test
   biznesowy (js/diagnoza-content-business.js) — różni je tylko treść pytań,
   tekstów i tematów niżej.
   ========================================================================== */

window.DIAGNOZA_GENERAL = (function () {
  function it(code, level, kind, tag, prompt, opts, ans) {
    return { code: code, level: level, kind: kind, tag: tag, prompt: prompt, opts: opts, ans: ans };
  }

  var BANK = {
    A1: [
      it("G-A1-01", "A1", "g", "Czasownik “to be”", "She ___ a teacher.", ["am", "is", "are"], 1),
      it("G-A1-02", "A1", "g", "Present Simple (3.os. -s)", "He ___ (work) in a bank.", ["work", "works", "working"], 1),
      it("G-A1-03", "A1", "g", "Present Simple — przeczenia", "They ___ like coffee.", ["don't", "doesn't", "not"], 0),
      it("G-A1-04", "A1", "g", "Przymiotniki dzierżawcze / 's", "This is Anna. ___ car is red.", ["She", "Her", "Hers"], 1),
      it("G-A1-05", "A1", "g", "Liczba mnoga rzeczowników", "I have two ___.", ["child", "childs", "children"], 2),
      it("G-A1-06", "A1", "g", "There is / There are", "___ a lot of books on the table.", ["There is", "There are", "It is"], 1),
      it("V-A1-01", "A1", "v", "Dni tygodnia / liczby", "What day comes after Monday?", ["Sunday", "Tuesday", "Friday"], 1),
      it("V-A1-02", "A1", "v", "Rodzina", "My mother's brother is my ___.", ["cousin", "uncle", "nephew"], 1),
      it("V-A1-03", "A1", "v", "Podstawowe czynności", "I ___ a shower every morning.", ["make", "take", "do"], 1),
      it("V-A1-04", "A1", "v", "Rzeczowniki codzienne", "Choose the word that does NOT belong: apple, banana, chair, orange", ["chair", "banana", "apple"], 0)
    ],
    A2: [
      it("G-A2-01", "A2", "g", "Past Simple", "Yesterday I ___ to the cinema with my friends.", ["go", "went", "goed"], 1),
      it("G-A2-02", "A2", "g", "Present Continuous", "Look! It ___ (rain).", ["rains", "is raining", "rain"], 1),
      it("G-A2-03", "A2", "g", "Stopniowanie przymiotników", "My sister is ___ than me. (tall)", ["more tall", "taller", "tallest"], 1),
      it("G-A2-04", "A2", "g", "Czas przyszły “going to”", "I've already packed my bags. I ___ leave tomorrow morning.", ["am going to", "will", "going"], 0),
      it("G-A2-05", "A2", "g", "have to / don't have to", "You ___ wear a seatbelt in the car — it's the law.", ["don't have to", "have to", "can"], 1),
      it("G-A2-06", "A2", "g", "some/any/much/many", "There isn't ___ milk left in the fridge.", ["many", "any", "some"], 1),
      it("V-A2-01", "A2", "v", "Codzienna rutyna", "I usually ___ up at 7 a.m. and ___ breakfast at 7:30.", ["get / have", "do / make", "take / do"], 0),
      it("V-A2-02", "A2", "v", "Zakupy / restauracja", "Can I have the ___, please? I'd like to pay.", ["menu", "bill", "receipt"], 1),
      it("V-A2-03", "A2", "v", "Pogoda", "It's very ___ today — take an umbrella.", ["cloudy", "freezing", "sunny"], 0),
      it("V-A2-04", "A2", "v", "Podstawowe uczucia", "I felt really ___ when I passed my exam.", ["bored", "excited", "tired"], 1)
    ],
    B1: [
      it("G-B1-01", "B1", "g", "Present Perfect vs Past Simple", "I ___ never ___ (be) to Japan, but I'd love to go one day.", ["have / been", "did / be", "am / being"], 0),
      it("G-B1-02", "B1", "g", "Past Continuous", "While I ___ (cook) dinner, the phone rang.", ["cooked", "was cooking", "cook"], 1),
      it("G-B1-03", "B1", "g", "First Conditional", "If it ___ tomorrow, we'll cancel the picnic.", ["rains", "will rain", "rained"], 0),
      it("G-B1-04", "B1", "g", "Strona bierna — czasy proste", "This bridge ___ (build) in 1990.", ["was built", "built", "has built"], 0),
      it("G-B1-05", "B1", "g", "Zdania względne definiujące", "The man ___ lives next door is a doctor.", ["which", "who", "whose"], 1),
      it("G-B1-06", "B1", "g", "Modalne przewidywania", "I think I'll take an umbrella — it ___ rain later.", ["is going to", "will", "might"], 2),
      it("V-B1-01", "B1", "v", "Phrasal verbs (give up)", "She had to ___ up smoking for health reasons.", ["give", "make", "take"], 0),
      it("V-B1-02", "B1", "v", "Kolokacje make/do", "I need to ___ a decision by Friday.", ["do", "make", "have"], 1),
      it("V-B1-03", "B1", "v", "Edukacja i osiągnięcia", "He's studying hard because he wants to ___ his degree this year.", ["complete", "fail", "drop"], 0),
      it("V-B1-04", "B1", "v", "Zdrowie i dolegliwości", "I have a terrible ___ — I need to see a dentist.", ["headache", "toothache", "stomachache"], 1)
    ],
    B2: [
      it("G-B2-01", "B2", "g", "Second Conditional", "If I ___ more time, I would learn another language.", ["had", "have", "would have"], 0),
      it("G-B2-02", "B2", "g", "Third Conditional", "If she ___ harder, she would have passed the exam.", ["studied", "had studied", "has studied"], 1),
      it("G-B2-03", "B2", "g", "Past Perfect Continuous", "I ___ (wait) for over an hour when the bus finally arrived.", ["waited", "was waiting", "had been waiting"], 2),
      it("G-B2-04", "B2", "g", "Mowa zależna", "She said that she ___ the report by Friday. (“I will finish the report by Friday.”)", ["will finish", "would finish", "finishes"], 1),
      it("G-B2-05", "B2", "g", "Modalne dedukcji", "He's not answering his phone — he ___ be asleep already.", ["must", "can", "should"], 0),
      it("G-B2-06", "B2", "g", "wish / if only", "I wish I ___ how to drive.", ["know", "knew", "had known"], 1),
      it("V-B2-01", "B2", "v", "Phrasal verbs biznesowe", "The company decided to ___ down the factory due to low demand.", ["shut", "close up", "shut off"], 0),
      it("V-B2-02", "B2", "v", "Słowotwórstwo", "His explanation was so ___ that nobody could follow it.", ["confusing", "confused", "confuse"], 0),
      it("V-B2-03", "B2", "v", "Gerundium po przyimku", "Despite ___ (try) hard, she didn't manage to finish on time.", ["trying", "to try", "tried"], 0),
      it("V-B2-04", "B2", "v", "Rozróżnianie bliskoznaczników", "We need to come up with a new ___ to solve this problem.", ["solution", "resolution", "dissolution"], 0)
    ],
    C1: [
      it("G-C1-01", "C1", "g", "Inwersja dla podkreślenia", "___ I realised how late it was, I called a taxi immediately.", ["No sooner had", "As soon as", "Hardly"], 0),
      it("G-C1-02", "C1", "g", "Zdania warunkowe mieszane", "If I had known you were coming, I ___ dinner.", ["would cook", "would have cooked", "will cook"], 1),
      it("G-C1-03", "C1", "g", "Zdania rozszczepione", "It was only after the meeting ___ realised the mistake.", ["that I", "when I", "I"], 0),
      it("G-C1-04", "C1", "g", "Konstrukcja “have something done”", "I had my car ___ last week.", ["repair", "repaired", "to repair"], 1),
      it("G-C1-05", "C1", "g", "Inwersja dla podkreślenia", "Not only ___ late, but he also forgot the documents.", ["he was", "was he", "he did"], 1),
      it("G-C1-06", "C1", "g", "Imiesłowowe równoważniki zdań", "Standing at the top of the hill, ___ stretched for miles in every direction.", ["the view", "it", "which"], 0),
      it("V-C1-01", "C1", "v", "Kolokacje abstrakcyjne", "The negotiations reached a ___ after months of disagreement.", ["breakthrough", "breakdown", "outbreak"], 0),
      it("V-C1-02", "C1", "v", "Precyzyjne przymiotniki oceniające", "His argument, while persuasive, was fundamentally ___.", ["flawed", "flawless", "flawing"], 0),
      it("V-C1-03", "C1", "v", "Idiomy dot. zdolności", "She has a ___ for languages — she picked up French in months.", ["gift", "present", "skillset"], 0),
      it("V-C1-04", "C1", "v", "Słownictwo formalne/akademickie", "The new policy is likely to have far-reaching ___ for small businesses.", ["implications", "implementations", "applications"], 0)
    ],
    C2: [
      it("G-C2-01", "C2", "g", "Formalne łączniki koncesywne", "___ the difficulties, the project was completed on time.", ["Despite of", "Notwithstanding", "Although of"], 1),
      it("G-C2-02", "C2", "g", "Tryb łączący (subjunctive)", "It is essential that he ___ present at the hearing.", ["is", "be", "will be"], 1),
      it("G-C2-03", "C2", "g", "Inwersja w rejestrze formalnym", "Rarely ___ such dedication in a junior employee.", ["we have seen", "have we seen", "we saw"], 1),
      it("G-C2-04", "C2", "g", "Precyzyjne rozumienie niuansów", "Choose the option closest in meaning to: “He didn't so much lie as withhold the full truth.”", ["He lied completely.", "He told the truth fully.", "He was technically honest but not fully forthcoming."], 2),
      it("V-C2-01", "C2", "v", "Rejestr formalny vs neutralny", "Formal report style — which fits best? “The results ___ our initial hypothesis.”", ["back up", "corroborate", "prove right"], 1),
      it("V-C2-02", "C2", "v", "Subtelne niuanse znaczeniowe", "Choose the word closest in nuance to “meticulous”:", ["careless", "painstaking", "quick"], 1),
      it("V-C2-03", "C2", "v", "Idiomy o niejednoznacznym wydźwięku", "“He was somewhat disingenuous in his response” means he was:", ["completely honest", "not entirely sincere", "very confused"], 1),
      it("V-C2-04", "C2", "v", "Konotacje bliskoznaczników", "Which pair are true synonyms with almost no difference in connotation?", ["stubborn / determined", "frugal / stingy", "adamant / resolute"], 2)
    ]
  };

  var READING = [
    { id: "R-A2", level: "A2", title: "A Day at the Market",
      text: "Every Saturday, Maria goes to the market near her house. She usually leaves home at nine o'clock and walks there with her daughter. The market is small, but it has a lot of fresh fruit and vegetables. Maria likes to buy tomatoes, apples, and bread from her favourite seller, Mr. Kowalski. He always gives her a good price because she is a regular customer. After shopping, Maria and her daughter often stop at a small café for a hot chocolate before going home. Maria says the market is her favourite part of the week because she meets her neighbours there and the food is fresher than in the supermarket.",
      qs: [
        { q: "What day does Maria go to the market?", opts: ["Friday", "Saturday", "Sunday"], ans: 1 },
        { q: "How does she get to the market?", opts: ["by car", "by bus", "on foot"], ans: 2 },
        { q: "Who does Maria buy fruit and bread from?", opts: ["her neighbour", "Mr. Kowalski", "her daughter"], ans: 1 },
        { q: "True or False: Maria and her daughter never stop anywhere after shopping.", opts: ["True", "False"], ans: 1 },
        { q: "Why does Maria like the market? (own words, 1 sentence)", open: true, kw: ["neighbour", "fresh"] }
      ] },
    { id: "R-B", level: "B1/B2", title: "Working from Home",
      text: "Over the past few years, working from home has become far more common than it used to be. For some employees, this shift has brought real benefits: no time wasted commuting, more flexibility to organise the day, and, in many cases, a better balance between work and family life. However, the change hasn't been entirely positive. Managers have reported that it can be harder to build a strong team spirit when colleagues rarely meet in person, and some employees admit they find it difficult to switch off in the evening when their laptop is always within reach. As a result, many companies are now experimenting with a hybrid model, in which staff come into the office two or three days a week and work from home the rest of the time. Whether this compromise will satisfy both employers and employees in the long run remains to be seen.",
      qs: [
        { q: "What is one advantage of working from home mentioned in the text?", opts: ["higher salary", "no commuting time", "more meetings"], ans: 1 },
        { q: "What problem do some managers mention?", opts: ["lower productivity", "difficulty building team spirit", "higher costs"], ans: 1 },
        { q: "What does “switch off” mean in this context?", opts: ["turn off a computer", "stop thinking about work", "leave the office building"], ans: 1 },
        { q: "What is a “hybrid model” according to the text?", opts: ["working fully remotely", "a mix of office and home days", "working only in the office"], ans: 1 },
        { q: "Does the author clearly state whether the hybrid model will succeed long-term? Justify briefly.", open: true, kw: ["not sure", "remains to be seen", "unclear", "doesn't say", "uncertain", "time will tell"] }
      ] },
    { id: "R-C1", level: "C1", title: "The Illusion of Multitasking",
      text: "For decades, multitasking was treated almost as a badge of honour in professional life — the ability to juggle emails, phone calls, and reports simultaneously was seen as a hallmark of efficiency. Cognitive science, however, tells a rather different story. What we call multitasking is, in most cases, not the parallel processing of two tasks but rapid switching between them, and each switch carries a measurable cost in time and accuracy. Researchers have found that people who frequently multitask on unrelated tasks are, somewhat counterintuitively, often worse at filtering out irrelevant information than those who focus on one thing at a time. This raises an uncomfortable question for modern workplaces, which are frequently designed around constant interruption — open-plan offices, instant messaging, and a culture that rewards quick responses over deep, uninterrupted concentration. Some organisations have begun to push back against this trend, introducing “focus hours” during which notifications are silenced and meetings are banned. Whether such measures represent a genuine cultural shift or merely a passing fad is, as yet, difficult to say.",
      qs: [
        { q: "According to the text, what does cognitive science suggest multitasking actually is?", opts: ["true parallel processing", "rapid switching between tasks", "a myth with no basis in reality"], ans: 1 },
        { q: "What surprising finding does the text mention about frequent multitaskers?", opts: ["they are better at filtering distractions", "they are often worse at filtering distractions", "they have better memory"], ans: 1 },
        { q: "What is implied by the phrase “badge of honour” in the first sentence?", opts: ["a literal medal", "something people were proud of", "something people were ashamed of"], ans: 1 },
        { q: "What is a “focus hour” as described in the text?", opts: ["a mandatory meeting", "a period without notifications or meetings", "a break from work"], ans: 1 },
        { q: "What is the author's overall stance on whether “focus hours” will last?", open: true, kw: ["uncertain", "difficult to say", "not sure", "fad", "time will tell"] }
      ] }
  ];

  var LISTENING = [
    { id: "L-A2", level: "A2", title: "On the bus",
      transcript: "A: Excuse me, is this seat free? B: Yes, go ahead. Are you going to the city centre? A: Yes, I need to get off near the train station. Do you know how many stops that is? B: I think it's about four stops from here. I'll tell you when we get close, if you like. A: Oh, that's very kind of you, thank you! I'm still learning my way around this city. B: No problem. Are you new here? A: Yes, I moved here two weeks ago for a new job.",
      qs: [
        { q: "Where does person A need to go?", opts: ["the airport", "the train station", "the city hall"], ans: 1 },
        { q: "How many stops away is it?", opts: ["two", "four", "six"], ans: 1 },
        { q: "Why does person A ask for help?", opts: ["they are completely lost", "they don't know the city well", "the bus is late"], ans: 1 },
        { q: "How long ago did person A move to the city?", opts: ["two days", "two weeks", "two months"], ans: 1 },
        { q: "True or False: Person B refuses to help.", opts: ["True", "False"], ans: 1 }
      ] },
    { id: "L-B", level: "B1/B2", title: "Running a bakery",
      transcript: "So I've been running my own small bakery for about five years now, and honestly, the hardest part was never the baking itself — it was learning how to manage a business. In the beginning, I was doing everything myself: baking at 4 a.m., serving customers, doing the accounts in the evening. I quickly realised that wasn't sustainable, so about two years in, I hired my first employee, and that changed everything. These days I spend most of my time on the business side — suppliers, marketing, planning new products — while my team handles the day-to-day baking. If I could give one piece of advice to someone starting out, it would be: don't be afraid to ask for help earlier than you think you need it.",
      qs: [
        { q: "How long has the speaker been running the bakery?", opts: ["two years", "five years", "ten years"], ans: 1 },
        { q: "What was the hardest part, according to the speaker?", opts: ["baking", "managing the business", "finding customers"], ans: 1 },
        { q: "When did the speaker hire their first employee?", opts: ["immediately", "about two years in", "after five years"], ans: 1 },
        { q: "What does the speaker mostly do now?", opts: ["baking every day", "business-side tasks like suppliers and marketing", "cleaning the shop"], ans: 1 },
        { q: "What advice does the speaker give? (own words)", open: true, kw: ["ask for help", "help earlier"] }
      ] },
    { id: "L-C1", level: "C1", title: "On creativity and pressure",
      transcript: "One thing that's often misunderstood about creativity in the workplace is the assumption that it flourishes best under pressure — the classic image of the last-minute deadline producing a burst of brilliant ideas. In reality, the research paints a more nuanced picture. Moderate time pressure can occasionally sharpen focus, but sustained or extreme pressure tends to narrow people's thinking rather than expand it — they fall back on familiar solutions instead of exploring genuinely novel ones. What seems to matter far more is a sense of psychological safety: people are more willing to propose unconventional ideas when they're confident that a bad idea won't be held against them. Organisations that claim to want innovation but punish failure harshly are, in effect, working against their own stated goals.",
      qs: [
        { q: "What common assumption about creativity does the speaker challenge?", opts: ["that creativity needs training", "that pressure improves creativity", "that creativity cannot be measured"], ans: 1 },
        { q: "According to the speaker, what does sustained extreme pressure do to thinking?", opts: ["it broadens it", "it narrows it", "it has no effect"], ans: 1 },
        { q: "What factor does the speaker say matters more than pressure?", opts: ["financial reward", "psychological safety", "team size"], ans: 1 },
        { q: "What contradiction does the speaker point out about some organisations?", opts: ["they claim to want innovation but punish failure", "they claim to punish failure but reward it", "they claim to have no rules but enforce many"], ans: 0 },
        { q: "In your own words, what is the speaker's main argument?", open: true, kw: ["psychological safety", "pressure", "punish failure"] }
      ] }
  ];

  var WRITING_TASKS = {
    A: { label: "Zadanie A (A1–A2)", prompt: "Write a short email to a friend. Say where you live now, what you do in your free time, and invite them to visit. (50–80 words)" },
    B: { label: "Zadanie B (B1–C1) · format zbliżony do IELTS Writing Task 2 / Cambridge Essay", prompt: "Some people say that remote work damages relationships between colleagues. Discuss both this view and the opposite one, then give your own opinion. (150–220 words)" }
  };

  var SPEAKING_PARTS = [
    { part: "Część 1", level: "A1–A2", title: "Rozmowa wstępna (interview)",
      qs: ["What's your name? Where are you from?", "What do you do? (praca / studia)", "Do you have any brothers or sisters? Tell me about your family.", "What do you usually do at the weekend?"] },
    { part: "Część 2", level: "B1", title: "Długa wypowiedź bez przerywania (long turn, ok. 1 min)",
      qs: ["Describe your daily routine, from morning to evening.", "Tell me about a memorable trip or holiday you took. What happened?"] },
    { part: "Część 3", level: "B2", title: "Opinia i porównanie",
      qs: ["What do you think are the advantages and disadvantages of social media?", "How has your city/town changed over the last ten years? Is that a good thing?"] },
    { part: "Część 4", level: "C1–C2", title: "Dyskusja abstrakcyjna",
      qs: ["To what extent do you think technology has made people more or less connected to each other?", "Some people say success is mostly hard work, others say it's mostly luck. What's your view, and why?"] }
  ];

  return {
    testType: "ogolny",
    testLabel: "Test ogólny",
    copy: {
      eyebrow: "Diagnoza poziomu · język angielski",
      title: "Dokładny test poziomujący z angielskiego.",
      intro: "Ten test składa się z kilku krótkich części: gramatyka i słownictwo, czytanie, słuchanie i pisanie. Każda część zaczyna się łatwo i staje się trudniejsza — test zatrzyma się sam, gdy dojdziesz do swojej granicy, więc nie zniechęcaj się, jeśli w pewnym momencie zrobi się trudno. To dobry znak, nie zły. Zajmie to około 40–60 minut. Na końcu automatycznie zapiszemy Twój wynik i przekażemy go Twojemu lektorowi."
    },
    BANK: BANK,
    READING: READING,
    LISTENING: LISTENING,
    WRITING_TASKS: WRITING_TASKS,
    SPEAKING_PARTS: SPEAKING_PARTS
  };
})();
