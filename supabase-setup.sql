-- ==========================================================================
-- OwnEnglish — konfiguracja bazy danych Supabase dla panelu administracyjnego
-- ==========================================================================
-- Jak tego użyć:
-- 1) Załóż darmowe konto na https://supabase.com i utwórz nowy projekt.
-- 2) W panelu projektu wejdź w "SQL Editor" → "New query".
-- 3) Wklej CAŁĄ zawartość tego pliku i kliknij "Run" — możesz to zrobić
--    bezpiecznie również ponownie, jeśli wcześniej już uruchamiałeś/aś
--    starszą wersję tego pliku (wszystkie polecenia są tak napisane, żeby
--    dało się je uruchomić wielokrotnie bez błędów).
-- 4) Gotowe — powstaną wszystkie tabele razem z regułami dostępu (RLS)
--    opisanymi niżej.
-- 5) WAŻNE — jeśli już wcześniej założyłeś/aś swoje konto administratora
--    (Authentication → Users → Add user), koniecznie wykonaj też sekcję
--    "0b) NADANIE SOBIE ROLI ADMINISTRATORA" niżej — bez tego Twoje własne
--    konto straci możliwość edycji strony po tej aktualizacji (patrz
--    wyjaśnienie w tej sekcji).
--
-- Jak to działa (w skrócie):
-- - Każdy odwiedzający stronę może CZYTAĆ dane oznaczone jako publiczne
--   (bo mają się wyświetlać na cenniku, w opiniach, w stopce itd.).
-- - Tylko administrator (Ty) może DODAWAĆ / EDYTOWAĆ / USUWAĆ większość
--   danych na stronie.
-- - Lektorzy (nowość) mogą samodzielnie założyć konto i zalogować się do
--   TEGO SAMEGO panelu (admin.html), ale widzą i edytują wyłącznie własny
--   profil i własny grafik zajęć — nigdy cudzych danych ani ustawień
--   administratora. Zobacz sekcje 8) i 9) niżej.
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 0a) ROLA ADMINISTRATORA — funkcja pomocnicza is_admin()
-- --------------------------------------------------------------------------
-- Od tej wersji strona rozróżnia dwie role: administrator i lektor. Obie to
-- zwykli zalogowani użytkownicy Supabase — różni ich tylko znacznik roli
-- w "app_metadata" konta, który MOŻNA ustawić wyłącznie z poziomu SQL
-- Editor (czyli z pełnym dostępem do bazy) — zwykły zalogowany użytkownik
-- (w tym lektor rejestrujący się samodzielnie) nie ma możliwości nadać
-- sobie roli administratora. To jest właśnie prawdziwe zabezpieczenie.
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- --------------------------------------------------------------------------
-- 0b) NADANIE SOBIE ROLI ADMINISTRATORA (wykonaj RAZ, po założeniu konta)
-- --------------------------------------------------------------------------
-- Podmień 'TWOJ-EMAIL@ownenglish.pl' na e-mail konta, którym logujesz się do
-- admin.html (to samo konto z Authentication → Users), i uruchom TYLKO
-- poniższe polecenie osobno (zaznacz je i kliknij "Run" dla zaznaczonego
-- fragmentu, albo uruchom cały plik — jest bezpieczne przy wielokrotnym
-- uruchamianiu). Bez tego kroku Twoje konto będzie traktowane jak konto
-- lektora, nie administratora.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'TWOJ-EMAIL@ownenglish.pl';


-- --------------------------------------------------------------------------
-- 1) CENNIK — pricing_packages
-- --------------------------------------------------------------------------
create table if not exists pricing_packages (
  id bigint generated always as identity primary key,
  category text not null check (category in ('individual', 'group')),
  name text not null,
  detail text not null,
  price text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table pricing_packages enable row level security;

drop policy if exists "Cennik: publiczny odczyt" on pricing_packages;
create policy "Cennik: publiczny odczyt"
  on pricing_packages for select
  using (true);

drop policy if exists "Cennik: zapis tylko dla zalogowanych" on pricing_packages;
drop policy if exists "Cennik: zapis tylko dla administratora" on pricing_packages;
create policy "Cennik: zapis tylko dla administratora"
  on pricing_packages for all
  using (is_admin())
  with check (is_admin());

-- Przykładowe dane startowe (odpowiadają temu, co dziś jest na sztywno w cennik.html)
insert into pricing_packages (category, name, detail, price, sort_order)
select * from (values
  ('individual', 'Pojedyncze zajęcia', '1 × 60 minut', '[cena PLN]', 1),
  ('individual', 'Pakiet Start', '4 zajęcia / miesiąc', '[cena PLN]', 2),
  ('individual', 'Pakiet Progres', '8 zajęć / miesiąc', '[cena PLN]', 3),
  ('individual', 'Przygotowanie do egzaminu', '8 zajęć / miesiąc', '[cena PLN]', 4),
  ('group', 'Grupa konwersacyjna', '3–5 osób', '[cena PLN] / miesiąc', 1)
) as seed(category, name, detail, price, sort_order)
where not exists (select 1 from pricing_packages);


-- --------------------------------------------------------------------------
-- 2) OPINIE KURSANTÓW — testimonials
-- --------------------------------------------------------------------------
create table if not exists testimonials (
  id bigint generated always as identity primary key,
  quote text not null,
  name text not null,
  role text not null,
  initials text not null default '',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;

drop policy if exists "Opinie: publiczny odczyt (tylko opublikowane)" on testimonials;
create policy "Opinie: publiczny odczyt (tylko opublikowane)"
  on testimonials for select
  using (published = true);

drop policy if exists "Opinie: pełny odczyt dla zalogowanych (w tym szkice)" on testimonials;
drop policy if exists "Opinie: pełny odczyt dla administratora (w tym szkice)" on testimonials;
create policy "Opinie: pełny odczyt dla administratora (w tym szkice)"
  on testimonials for select
  using (is_admin());

drop policy if exists "Opinie: zapis tylko dla zalogowanych" on testimonials;
drop policy if exists "Opinie: zapis tylko dla administratora" on testimonials;
create policy "Opinie: zapis tylko dla administratora"
  on testimonials for insert
  with check (is_admin());

drop policy if exists "Opinie: edycja tylko dla zalogowanych" on testimonials;
drop policy if exists "Opinie: edycja tylko dla administratora" on testimonials;
create policy "Opinie: edycja tylko dla administratora"
  on testimonials for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "Opinie: usuwanie tylko dla zalogowanych" on testimonials;
drop policy if exists "Opinie: usuwanie tylko dla administratora" on testimonials;
create policy "Opinie: usuwanie tylko dla administratora"
  on testimonials for delete
  using (is_admin());

-- Przykładowe dane startowe (placeholdery — podmień na prawdziwe opinie w panelu)
insert into testimonials (quote, name, role, initials, sort_order)
select * from (values
  ('[Miejsce na opinię kursanta nr 1 — do uzupełnienia]', '[Imię i nazwisko]', '[Studentka, przygotowanie do wyjazdu]', 'JK', 1),
  ('[Miejsce na opinię kursanta nr 2 — do uzupełnienia]', '[Imię i nazwisko]', '[Specjalistka HR, kurs konwersacyjny]', 'AM', 2),
  ('[Miejsce na opinię kursanta nr 3 — do uzupełnienia]', '[Imię i nazwisko]', '[Freelancer, angielski biznesowy]', 'PT', 3)
) as seed(quote, name, role, initials, sort_order)
where not exists (select 1 from testimonials);


-- --------------------------------------------------------------------------
-- 3) DANE KONTAKTOWE — contact_info (zawsze dokładnie jeden wiersz, id = 1)
-- --------------------------------------------------------------------------
create table if not exists contact_info (
  id int primary key default 1,
  email text,
  phone text,
  location text,
  instagram_url text,
  facebook_url text,
  linkedin_url text,
  updated_at timestamptz not null default now(),
  constraint contact_info_single_row check (id = 1)
);

alter table contact_info enable row level security;

drop policy if exists "Kontakt: publiczny odczyt" on contact_info;
create policy "Kontakt: publiczny odczyt"
  on contact_info for select
  using (true);

drop policy if exists "Kontakt: zapis tylko dla zalogowanych" on contact_info;
drop policy if exists "Kontakt: zapis tylko dla administratora" on contact_info;
create policy "Kontakt: zapis tylko dla administratora"
  on contact_info for all
  using (is_admin())
  with check (is_admin());

insert into contact_info (id, email, phone, location) values
  (1, 'kontakt@ownenglish.pl', '[numer telefonu]', '[lokalizacja — jeśli prowadzone są zajęcia stacjonarne]')
on conflict (id) do nothing;


-- --------------------------------------------------------------------------
-- 4) TREŚCI STRON — site_content (uniwersalne pary klucz → wartość)
-- --------------------------------------------------------------------------
create table if not exists site_content (
  id bigint generated always as identity primary key,
  key text not null unique,
  label text not null,
  value text not null default '',
  input_type text not null default 'text' check (input_type in ('text', 'textarea')),
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table site_content enable row level security;

drop policy if exists "Treści: publiczny odczyt" on site_content;
create policy "Treści: publiczny odczyt"
  on site_content for select
  using (true);

drop policy if exists "Treści: zapis tylko dla zalogowanych" on site_content;
drop policy if exists "Treści: zapis tylko dla administratora" on site_content;
create policy "Treści: zapis tylko dla administratora"
  on site_content for all
  using (is_admin())
  with check (is_admin());

insert into site_content (key, label, value, input_type, sort_order) values
  ('index_trust_years', 'Strona główna — lata doświadczenia (pasek zaufania, pełny tekst np. "12 lat")', '[X] lat', 'text', 1),
  ('index_trust_courses', 'Strona główna — liczba przeprowadzonych kursów (pasek zaufania)', '[Y]+', 'text', 2),
  ('index_trust_recommend', 'Strona główna — % poleceń (pasek zaufania)', '[Z]%', 'text', 3),
  ('oferta_format_text', 'Oferta — opis formatu zajęć (online / stacjonarnie)', '[Do uzupełnienia: opis formatu zajęć — online / stacjonarnie oraz szczegóły.]', 'textarea', 4),
  ('oferta_duration_text', 'Oferta — długość i częstotliwość spotkań', '[Do uzupełnienia: długość pojedynczych zajęć i typowa częstotliwość spotkań.]', 'textarea', 5),
  ('o_mnie_historia', 'O mnie — akapit "historia"', '[Do uzupełnienia: historia marki i prowadzącego — doświadczenie, droga zawodowa.]', 'textarea', 6),
  ('o_mnie_metodologia', 'O mnie — akapit "jak uczę" (metodologia)', '[Do uzupełnienia: opis metodologii nauczania.]', 'textarea', 7),
  ('lektor_photo_url', 'Zdjęcie lektora (URL — ustawiane automatycznie po wgraniu pliku w panelu)', '', 'text', 8)
on conflict (key) do nothing;


-- --------------------------------------------------------------------------
-- 5) FAQ — faq_items
-- --------------------------------------------------------------------------
create table if not exists faq_items (
  id bigint generated always as identity primary key,
  question text not null,
  answer text not null,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table faq_items enable row level security;

drop policy if exists "FAQ: publiczny odczyt (tylko opublikowane)" on faq_items;
create policy "FAQ: publiczny odczyt (tylko opublikowane)"
  on faq_items for select
  using (published = true);

drop policy if exists "FAQ: pełny odczyt dla zalogowanych (w tym szkice)" on faq_items;
drop policy if exists "FAQ: pełny odczyt dla administratora (w tym szkice)" on faq_items;
create policy "FAQ: pełny odczyt dla administratora (w tym szkice)"
  on faq_items for select
  using (is_admin());

drop policy if exists "FAQ: zapis tylko dla zalogowanych" on faq_items;
drop policy if exists "FAQ: zapis tylko dla administratora" on faq_items;
create policy "FAQ: zapis tylko dla administratora"
  on faq_items for insert
  with check (is_admin());

drop policy if exists "FAQ: edycja tylko dla zalogowanych" on faq_items;
drop policy if exists "FAQ: edycja tylko dla administratora" on faq_items;
create policy "FAQ: edycja tylko dla administratora"
  on faq_items for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "FAQ: usuwanie tylko dla zalogowanych" on faq_items;
drop policy if exists "FAQ: usuwanie tylko dla administratora" on faq_items;
create policy "FAQ: usuwanie tylko dla administratora"
  on faq_items for delete
  using (is_admin());

insert into faq_items (question, answer, sort_order)
select * from (values
  ('Jak wygląda proces zapisu na kurs?', 'Zaczynamy od bezpłatnej konsultacji — sprawdzamy Twój poziom, cel i preferowany format zajęć. Na tej podstawie proponujemy pakiet i ustalamy harmonogram pierwszych spotkań.', 1),
  ('Nie znam swojego poziomu — jak go sprawdzić?', 'Nie musisz znać go z góry. Poziom określamy razem podczas bezpłatnej konsultacji — możesz też skorzystać z krótkiego testu poziomującego, dostępnego też na stronie głównej.', 2),
  ('Jakie są dostępne formy płatności?', '[Do uzupełnienia: akceptowane metody płatności — np. przelew, płatność online, BLIK. Poinformuj, jakie formy chcesz udostępnić.]', 3),
  ('Czy mogę odwołać lub przełożyć zajęcia?', 'Tak — zajęcia można odwołać lub przełożyć z odpowiednim wyprzedzeniem. [Do uzupełnienia: dokładna liczba godzin/dni wyprzedzenia oraz zasady w przypadku spóźnionego odwołania.]', 4),
  ('Czy zajęcia odbywają się online, czy stacjonarnie?', 'Obie opcje są dostępne — wybierasz to, co jest dla Ciebie wygodniejsze. Zajęcia stacjonarne odbywają się [lokalizacja do potwierdzenia].', 5),
  ('Ile trwają zajęcia i jak często się odbywają?', 'Standardowo spotkania trwają [45–60 minut], zwykle [1–2 razy w tygodniu]. Dokładny harmonogram dopasowujemy indywidualnie na konsultacji.', 6),
  ('Czy prowadzicie kursy dla firm?', 'Tak — przygotowujemy programy szkoleniowe dla zespołów, dopasowane do branży i celów biznesowych. Szczegóły znajdziesz na stronie „Dla firm”.', 7),
  ('Czy oferujecie kursy w innych językach niż angielski?', 'Obecnie skupiamy się na języku angielskim. Rozszerzenie oferty o kolejne języki rozważamy w przyszłości.', 8)
) as seed(question, answer, sort_order)
where not exists (select 1 from faq_items);


-- --------------------------------------------------------------------------
-- 6) LEKCJE WIDEO — video_lessons (osadzone z YouTube, wideo niepubliczne)
-- --------------------------------------------------------------------------
create table if not exists video_lessons (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  youtube_id text not null,
  level text not null default '' check (level in ('', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table video_lessons enable row level security;

drop policy if exists "Lekcje wideo: publiczny odczyt (tylko opublikowane)" on video_lessons;
create policy "Lekcje wideo: publiczny odczyt (tylko opublikowane)"
  on video_lessons for select
  using (published = true);

drop policy if exists "Lekcje wideo: pełny odczyt dla zalogowanych (w tym szkice)" on video_lessons;
drop policy if exists "Lekcje wideo: pełny odczyt dla administratora (w tym szkice)" on video_lessons;
create policy "Lekcje wideo: pełny odczyt dla administratora (w tym szkice)"
  on video_lessons for select
  using (is_admin());

drop policy if exists "Lekcje wideo: zapis tylko dla zalogowanych" on video_lessons;
drop policy if exists "Lekcje wideo: zapis tylko dla administratora" on video_lessons;
create policy "Lekcje wideo: zapis tylko dla administratora"
  on video_lessons for insert
  with check (is_admin());

drop policy if exists "Lekcje wideo: edycja tylko dla zalogowanych" on video_lessons;
drop policy if exists "Lekcje wideo: edycja tylko dla administratora" on video_lessons;
create policy "Lekcje wideo: edycja tylko dla administratora"
  on video_lessons for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "Lekcje wideo: usuwanie tylko dla zalogowanych" on video_lessons;
drop policy if exists "Lekcje wideo: usuwanie tylko dla administratora" on video_lessons;
create policy "Lekcje wideo: usuwanie tylko dla administratora"
  on video_lessons for delete
  using (is_admin());

-- Brak danych startowych — lista lekcji jest pusta, dopóki nie dodasz
-- pierwszej w panelu admina (zakładka "Filmiki - lekcje").


-- --------------------------------------------------------------------------
-- 7) MAGAZYN PLIKÓW — bucket "media" (zdjęcia lektorów i inne grafiki)
-- --------------------------------------------------------------------------
-- Publiczny bucket do przechowywania zdjęć. Administrator może wgrywać
-- dowolny plik. Lektor (patrz sekcja 8) może wgrywać WYŁĄCZNIE do swojego
-- własnego podfolderu "tutor-photos/<jego-ID-użytkownika>/..." — to
-- uniemożliwia lektorowi podmianę cudzego zdjęcia albo innych plików.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Media: publiczny odczyt plików" on storage.objects;
create policy "Media: publiczny odczyt plików"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "Media: wgrywanie tylko dla zalogowanych" on storage.objects;
drop policy if exists "Media: wgrywanie (admin wszystko, lektor tylko swój folder)" on storage.objects;
create policy "Media: wgrywanie (admin wszystko, lektor tylko swój folder)"
  on storage.objects for insert
  with check (
    bucket_id = 'media' and (
      is_admin()
      or (auth.uid() is not null and name like 'tutor-photos/' || auth.uid()::text || '/%')
    )
  );

drop policy if exists "Media: aktualizacja tylko dla zalogowanych" on storage.objects;
drop policy if exists "Media: aktualizacja (admin wszystko, lektor tylko swój folder)" on storage.objects;
create policy "Media: aktualizacja (admin wszystko, lektor tylko swój folder)"
  on storage.objects for update
  using (
    bucket_id = 'media' and (
      is_admin()
      or (auth.uid() is not null and name like 'tutor-photos/' || auth.uid()::text || '/%')
    )
  )
  with check (
    bucket_id = 'media' and (
      is_admin()
      or (auth.uid() is not null and name like 'tutor-photos/' || auth.uid()::text || '/%')
    )
  );

drop policy if exists "Media: usuwanie tylko dla zalogowanych" on storage.objects;
drop policy if exists "Media: usuwanie tylko dla administratora" on storage.objects;
create policy "Media: usuwanie tylko dla administratora"
  on storage.objects for delete
  using (bucket_id = 'media' and is_admin());


-- --------------------------------------------------------------------------
-- 8) PROFILE LEKTORÓW — tutor_profiles (samodzielna rejestracja + moderacja)
-- --------------------------------------------------------------------------
-- Każdy lektor zakłada konto samodzielnie (formularz "Zarejestruj się jako
-- lektor" na admin.html) i loguje się do tego samego panelu co Ty. Nowe
-- konto zawsze startuje ze statusem "pending" (oczekuje) — dopóki go nie
-- zatwierdzisz w panelu (sekcja "Lektorzy"), lektor widzi tylko komunikat
-- o oczekiwaniu i nie może niczego opublikować.
--
-- Po zatwierdzeniu konta lektor może edytować swój profil (imię, opis,
-- zdjęcie) — ale każda taka zmiana trafia do pól "pending_*" i czeka na
-- Twoją akceptację (sekcja "Lektorzy" → "Do zatwierdzenia"). Dopiero gdy
-- zatwierdzisz zmiany, trafiają one do pól widocznych publicznie
-- (name/bio/photo_url) i mogą pojawić się na stronie „Nasz zespół”
-- (dodatkowo musi być też włączony przełącznik "opublikowany").
--
-- Pilnuje tego wyzwalacz (trigger) niżej: jeśli zapisu dokonuje ktoś, kto
-- NIE jest administratorem, pola "oficjalne" (name/bio/photo_url/
-- account_status/published/rejection_reason) są automatycznie
-- przywracane do poprzedniej wartości — czyli lektor fizycznie nie jest
-- w stanie sam siebie zatwierdzić ani opublikować, nawet gdyby spróbował
-- wysłać taki zapis ręcznie (np. z konsoli przeglądarki).
create table if not exists tutor_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  bio text not null default '',
  photo_url text not null default '',
  pending_name text not null default '',
  pending_bio text not null default '',
  pending_photo_url text not null default '',
  has_pending_submission boolean not null default false,
  account_status text not null default 'pending' check (account_status in ('pending', 'approved', 'rejected')),
  rejection_reason text not null default '',
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tutor_profiles enable row level security;

create or replace function protect_tutor_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if not is_admin() then
    new.user_id := old.user_id;
    new.email := old.email;
    new.account_status := old.account_status;
    new.rejection_reason := old.rejection_reason;
    new.published := old.published;
    new.name := old.name;
    new.bio := old.bio;
    new.photo_url := old.photo_url;
    new.sort_order := old.sort_order;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_tutor_profile on tutor_profiles;
create trigger trg_protect_tutor_profile
  before update on tutor_profiles
  for each row execute function protect_tutor_profile_privileged_fields();

drop policy if exists "Lektorzy: publiczny odczyt opublikowanych profili" on tutor_profiles;
create policy "Lektorzy: publiczny odczyt opublikowanych profili"
  on tutor_profiles for select
  using (published = true);

drop policy if exists "Lektorzy: własny profil widoczny dla właściciela" on tutor_profiles;
create policy "Lektorzy: własny profil widoczny dla właściciela"
  on tutor_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Lektorzy: admin widzi wszystkie profile" on tutor_profiles;
create policy "Lektorzy: admin widzi wszystkie profile"
  on tutor_profiles for select
  using (is_admin());

drop policy if exists "Lektorzy: rejestracja własnego profilu" on tutor_profiles;
create policy "Lektorzy: rejestracja własnego profilu"
  on tutor_profiles for insert
  with check (
    auth.uid() = user_id
    and account_status = 'pending'
    and published = false
  );

drop policy if exists "Lektorzy: aktualizacja własnego profilu lub przez admina" on tutor_profiles;
create policy "Lektorzy: aktualizacja własnego profilu lub przez admina"
  on tutor_profiles for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

drop policy if exists "Lektorzy: usuwanie tylko przez admina" on tutor_profiles;
create policy "Lektorzy: usuwanie tylko przez admina"
  on tutor_profiles for delete
  using (is_admin());


-- --------------------------------------------------------------------------
-- 9) GRAFIK ZAJĘĆ — lesson_schedule (wpisy lektorów, wgląd administratora)
-- --------------------------------------------------------------------------
-- Każdy lektor samodzielnie wpisuje swoje zajęcia (uczeń, data, godzina,
-- notatki) — bez moderacji, bo to wewnętrzna notatka, nie treść publiczna.
-- Ty jako administrator widzisz i możesz edytować grafik WSZYSTKICH
-- lektorów naraz (sekcja "Grafik zajęć" w panelu). Dane te nigdy nie są
-- publicznie widoczne na stronie.
create table if not exists lesson_schedule (
  id bigint generated always as identity primary key,
  tutor_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  student_contact text not null default '',
  lesson_date date not null,
  lesson_time text not null default '',
  duration_minutes int not null default 60,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table lesson_schedule enable row level security;

drop policy if exists "Grafik: lektor widzi własne wpisy" on lesson_schedule;
create policy "Grafik: lektor widzi własne wpisy"
  on lesson_schedule for select
  using (auth.uid() = tutor_id);

drop policy if exists "Grafik: admin widzi wszystkie wpisy" on lesson_schedule;
create policy "Grafik: admin widzi wszystkie wpisy"
  on lesson_schedule for select
  using (is_admin());

drop policy if exists "Grafik: lektor dodaje własne wpisy" on lesson_schedule;
create policy "Grafik: lektor dodaje własne wpisy"
  on lesson_schedule for insert
  with check (auth.uid() = tutor_id or is_admin());

drop policy if exists "Grafik: edycja własnych wpisów lub przez admina" on lesson_schedule;
create policy "Grafik: edycja własnych wpisów lub przez admina"
  on lesson_schedule for update
  using (auth.uid() = tutor_id or is_admin())
  with check (auth.uid() = tutor_id or is_admin());

drop policy if exists "Grafik: usuwanie własnych wpisów lub przez admina" on lesson_schedule;
create policy "Grafik: usuwanie własnych wpisów lub przez admina"
  on lesson_schedule for delete
  using (auth.uid() = tutor_id or is_admin());


-- ==========================================================================
-- Koniec. Następne kroki:
-- 1. Authentication → Users → Add user — utwórz swoje konto logowania do
--    panelu (jeśli jeszcze tego nie zrobiłeś/aś).
-- 2. Uruchom polecenie z sekcji "0b" wyżej (z Twoim e-mailem), żeby nadać
--    temu kontu rolę administratora.
-- 3. Project Settings → API — skopiuj "Project URL" i "anon public" key
--    do pliku js/supabase-config.js.
-- 4. Otwórz admin.html i zaloguj się swoim kontem administratora.
-- Nowi lektorzy zakładają konto samodzielnie przyciskiem "Zarejestruj się
-- jako lektor" na tej samej stronie logowania — Ty zatwierdzasz każde
-- nowe konto i każdą zmianę profilu w sekcji "Lektorzy" panelu.
-- ==========================================================================
