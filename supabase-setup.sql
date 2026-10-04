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
  ('Czy prowadzicie kursy dla firm?', 'Tak — przygotowujemy programy szkoleniowe dla zespołów, dopasowane do branży i celów biznesowych. Szczegóły znajdziesz na stronie „Dla firm".', 7),
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
    is_admin()
    or (auth.uid() = user_id and account_status = 'pending' and published = false)
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
-- 8b) LEKTORZY DODANI RĘCZNIE PRZEZ ADMINA (BEZ WŁASNEGO KONTA)
-- --------------------------------------------------------------------------
alter table tutor_profiles alter column user_id drop not null;


-- --------------------------------------------------------------------------
-- 9) GRAFIK ZAJĘĆ — lesson_schedule (wpisy lektorów, wgląd administratora)
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- 9b) STATUS ZAJĘĆ + GRAFIK ADMINA (dopisek do sekcji 9 powyżej)
-- --------------------------------------------------------------------------
alter table lesson_schedule add column if not exists status text not null default 'planned';

-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- 10) STAWKA GODZINOWA — admin_settings (do "Podsumowania miesiąca")
-- --------------------------------------------------------------------------
create table if not exists admin_settings (
  id int primary key default 1,
  hourly_rate numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint admin_settings_single_row check (id = 1)
);

alter table admin_settings enable row level security;

drop policy if exists "Ustawienia admina: tylko administrator" on admin_settings;
create policy "Ustawienia admina: tylko administrator"
  on admin_settings for all
  using (is_admin())
  with check (is_admin());

insert into admin_settings (id, hourly_rate) values (1, 0)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 11) SERIA POWTARZAJĄCYCH SIĘ ZAJĘĆ — kolumna series_id (do zbiorczego usuwania)
-- --------------------------------------------------------------------------
alter table lesson_schedule add column if not exists series_id uuid;

-- --------------------------------------------------------------------------
-- 12) WIDOCZNOŚĆ ZAKŁADEK — nav_visibility (wyłączanie sekcji strony)
-- --------------------------------------------------------------------------
create table if not exists nav_visibility (
  page_key text primary key,
  label text not null default '',
  visible boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table nav_visibility enable row level security;

drop policy if exists "Zakładki: publiczny odczyt" on nav_visibility;
create policy "Zakładki: publiczny odczyt"
  on nav_visibility for select
  using (true);

drop policy if exists "Zakładki: aktualizacja tylko admin" on nav_visibility;
create policy "Zakładki: aktualizacja tylko admin"
  on nav_visibility for update
  using (is_admin())
  with check (is_admin());

insert into nav_visibility (page_key, label, sort_order) values
  ('oferta', 'Kursy angielskiego', 1),
  ('dla-firm', 'Dla firm', 2),
  ('cennik', 'Cennik', 3),
  ('o-mnie', 'O mnie', 4),
  ('zespol', 'Nasz zespół', 5),
  ('lekcje', 'Lekcje wideo', 6),
  ('webinary', 'Webinary', 7),
  ('faq', 'FAQ', 8)
on conflict (page_key) do nothing;

insert into nav_visibility (page_key, label, sort_order) values
  ('tlumaczenia', 'Tłumaczenia', 9)
on conflict (page_key) do nothing;

-- --------------------------------------------------------------------------
-- 13) SŁOWO NA DZIŚ — words_of_day (codzienna rotacja słówka na stronie głównej)
-- --------------------------------------------------------------------------
create table if not exists words_of_day (
  id bigint generated always as identity primary key,
  word text not null default '',
  part_of_speech text not null default '',
  pronunciation text not null default '',
  dialect_label text not null default 'AmE',
  definition text not null default '',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table words_of_day enable row level security;

drop policy if exists "Słówka: publiczny odczyt opublikowanych" on words_of_day;
create policy "Słówka: publiczny odczyt opublikowanych"
  on words_of_day for select
  using (published = true);

drop policy if exists "Słówka: pełny dostęp admina" on words_of_day;
create policy "Słówka: pełny dostęp admina"
  on words_of_day for all
  using (is_admin())
  with check (is_admin());

insert into words_of_day (word, part_of_speech, pronunciation, dialect_label, definition, sort_order)
select * from (values
  ('understood', 'przym.', '/ˌʌn.dərˈstʊd/', 'AmE', 'w pełni zrozumiany przez rozmówcę — bez nieporozumień.', 1),
  ('fluent', 'przym.', '/ˈfluː.ənt/', 'AmE', 'mówiący płynnie, bez zacinania się i długich przerw na szukanie słów.', 2),
  ('confidence', 'rzecz.', '/ˈkɑːn.fə.dəns/', 'AmE', 'pewność siebie w mówieniu, nawet gdy zdanie nie jest idealne gramatycznie.', 3),
  ('hesitate', 'czas.', '/ˈhez.ɪ.teɪt/', 'AmE', 'wahać się, zwlekać z odpowiedzią z obawy przed błędem.', 4),
  ('articulate', 'czas.', '/ɑːrˈtɪk.jə.leɪt/', 'AmE', 'wyrażać myśli jasno i wyraźnie, tak żeby rozmówca nie musiał się domyślać.', 5),
  ('mumble', 'czas.', '/ˈmʌm.bəl/', 'AmE', 'mówić niewyraźnie, pod nosem — najczęstsza przyczyna „nie zrozumiałem".', 6),
  ('clarify', 'czas.', '/ˈkler.ə.faɪ/', 'AmE', 'doprecyzować, wyjaśnić coś, co zabrzmiało niejasno.', 7),
  ('small talk', 'rzecz.', '/smɔːl tɔːk/', 'AmE', 'luźna, towarzyska rozmowa o niczym — pogoda, weekend, dojazd do pracy.', 8),
  ('filler word', 'rzecz.', '/ˈfɪl.ər wɜːrd/', 'AmE', 'słowo-wypełniacz (np. „um", „like"), którym zyskujemy czas na myślenie.', 9),
  ('straightforward', 'przym.', '/ˌstreɪtˈfɔːr.wərd/', 'AmE', 'prosty, bezpośredni, łatwy do zrozumienia — bez owijania w bawełnę.', 10),
  ('accent', 'rzecz.', '/ˈæk.sent/', 'AmE', 'akcent — sposób wymawiania głosek charakterystyczny dla regionu lub języka ojczystego.', 11),
  ('tone', 'rzecz.', '/toʊn/', 'AmE', 'ton głosu — często mówi więcej niż same słowa.', 12),
  ('assertive', 'przym.', '/əˈsɜːr.tɪv/', 'AmE', 'stanowczy, wyrażający swoje zdanie wprost, ale bez agresji.', 13),
  ('paraphrase', 'czas.', '/ˈper.ə.freɪz/', 'AmE', 'powiedzieć to samo innymi słowami, gdy pierwsza wersja nie zadziałała.', 14),
  ('concise', 'przym.', '/kənˈsaɪs/', 'AmE', 'zwięzły — mówiący dokładnie tyle, ile trzeba, bez zbędnych słów.', 15),
  ('interrupt', 'czas.', '/ˌɪn.təˈrʌpt/', 'AmE', 'przerywać komuś wypowiedź — w rozmowie biznesowej lepiej robić to grzecznie.', 16),
  ('awkward', 'przym.', '/ˈɔːk.wərd/', 'AmE', 'niezręczny — o sytuacji albo o milczeniu, które trwa trochę za długo.', 17),
  ('persuasive', 'przym.', '/pərˈsweɪ.sɪv/', 'AmE', 'przekonujący — potrafiący skłonić rozmówcę do zmiany zdania.', 18),
  ('idiom', 'rzecz.', '/ˈɪd.i.əm/', 'AmE', 'idiom — wyrażenie, którego nie da się przetłumaczyć słowo w słowo.', 19),
  ('context', 'rzecz.', '/ˈkɑːn.tekst/', 'AmE', 'kontekst — to, co pozwala zrozumieć słowo nawet wtedy, gdy go nie znamy.', 20),
  ('negotiate', 'czas.', '/nɪˈɡoʊ.ʃi.eɪt/', 'AmE', 'negocjować — dochodzić do porozumienia poprzez rozmowę i ustępstwa.', 21),
  ('networking', 'rzecz.', '/ˈnet.wɜːr.kɪŋ/', 'AmE', 'nawiązywanie kontaktów zawodowych — często zaczyna się od zwykłej rozmowy.', 22),
  ('elaborate', 'czas.', '/ɪˈlæb.ə.reɪt/', 'AmE', 'rozwinąć temat, powiedzieć więcej szczegółów na dane pytanie.', 23),
  ('rehearse', 'czas.', '/rɪˈhɜːrs/', 'AmE', 'przećwiczyć wypowiedź wcześniej, np. przed ważną rozmową czy prezentacją.', 24),
  ('pace', 'rzecz.', '/peɪs/', 'AmE', 'tempo mówienia — zbyt szybkie utrudnia zrozumienie, zbyt wolne usypia rozmówcę.', 25),
  ('emphasis', 'rzecz.', '/ˈem.fə.sɪs/', 'AmE', 'nacisk — podkreślenie wybranego słowa w zdaniu, żeby zmienić jego wydźwięk.', 26),
  ('slang', 'rzecz.', '/slæŋ/', 'AmE', 'luźne, potoczne słownictwo, którego nie znajdziesz w podręczniku.', 27),
  ('proficient', 'przym.', '/prəˈfɪʃ.ənt/', 'AmE', 'biegły — posiadający solidne, praktyczne opanowanie języka.', 28),
  ('rapport', 'rzecz.', '/ræˈpɔːr/', 'AmE', 'dobra, naturalna relacja z rozmówcą, oparta na wzajemnym zrozumieniu.', 29),
  ('breakthrough', 'rzecz.', '/ˈbreɪk.θruː/', 'AmE', 'przełom — moment, w którym język „się klika", a mówienie przestaje być wysiłkiem.', 30)
) as seed(word, part_of_speech, pronunciation, dialect_label, definition, sort_order)
where not exists (select 1 from words_of_day);

-- --------------------------------------------------------------------------
-- 14) WEBINARY — webinars (zaproszeni goście, spotkania online)
-- --------------------------------------------------------------------------
create table if not exists webinars (
  id bigint generated always as identity primary key,
  title text not null default '',
  speaker_name text not null default '',
  speaker_bio text not null default '',
  event_date date,
  event_time text not null default '',
  description text not null default '',
  link_url text not null default '',
  link_label text not null default 'Dołącz',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table webinars enable row level security;

drop policy if exists "Webinary: publiczny odczyt opublikowanych" on webinars;
create policy "Webinary: publiczny odczyt opublikowanych"
  on webinars for select
  using (published = true);

drop policy if exists "Webinary: pełny dostęp admina" on webinars;
create policy "Webinary: pełny dostęp admina"
  on webinars for all
  using (is_admin())
  with check (is_admin());

insert into nav_visibility (page_key, label, sort_order) values
  ('webinary', 'Webinary', 7)
on conflict (page_key) do nothing;

-- --------------------------------------------------------------------------
-- 15) WEBINARY — obrazek marketingowy + zapisy uczestników (webinar_registrations)
-- --------------------------------------------------------------------------
alter table webinars add column if not exists image_url text not null default '';

create table if not exists webinar_registrations (
  id bigint generated always as identity primary key,
  webinar_id bigint not null references webinars(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  consent boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists webinar_registrations_unique_email
  on webinar_registrations (webinar_id, lower(email));

alter table webinar_registrations enable row level security;

drop policy if exists "Zapisy na webinar: publiczny zapis" on webinar_registrations;
create policy "Zapisy na webinar: publiczny zapis"
  on webinar_registrations for insert
  with check (consent = true);

drop policy if exists "Zapisy na webinar: odczyt tylko admin" on webinar_registrations;
create policy "Zapisy na webinar: odczyt tylko admin"
  on webinar_registrations for select
  using (is_admin());

drop policy if exists "Zapisy na webinar: usuwanie tylko admin" on webinar_registrations;
create policy "Zapisy na webinar: usuwanie tylko admin"
  on webinar_registrations for delete
  using (is_admin());

-- --------------------------------------------------------------------------
-- 16) DIAGNOZA POGŁĘBIONA — kody dostępu (diagnosis_codes) i wyniki (diagnosis_results)
-- --------------------------------------------------------------------------
create table if not exists diagnosis_codes (
  id bigint generated always as identity primary key,
  code text not null,
  student_name text not null default '',
  active boolean not null default true,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists diagnosis_codes_unique_code
  on diagnosis_codes (upper(code));

alter table diagnosis_codes enable row level security;

drop policy if exists "Kody diagnozy: pelny dostep tylko admin" on diagnosis_codes;
create policy "Kody diagnozy: pelny dostep tylko admin"
  on diagnosis_codes for all
  using (is_admin())
  with check (is_admin());

create or replace function check_diagnosis_code(p_code text)
returns table(student_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update diagnosis_codes
  set used_at = now()
  where upper(diagnosis_codes.code) = upper(p_code) and active = true and used_at is null;

  return query
  select dc.student_name
  from diagnosis_codes dc
  where upper(dc.code) = upper(p_code) and dc.active = true;
end;
$$;

grant execute on function check_diagnosis_code(text) to anon, authenticated;

create table if not exists diagnosis_results (
  id bigint generated always as identity primary key,
  code text not null default '',
  student_name text not null default '',
  test_type text not null default '',
  levels jsonb not null default '{}'::jsonb,
  writing_text text not null default '',
  writing_ai jsonb,
  checklist jsonb not null default '[]'::jsonb,
  speaking_detail jsonb,
  report_text text not null default '',
  created_at timestamptz not null default now()
);

alter table diagnosis_results enable row level security;

drop policy if exists "Wyniki diagnozy: publiczny zapis" on diagnosis_results;
create policy "Wyniki diagnozy: publiczny zapis"
  on diagnosis_results for insert
  with check (true);

drop policy if exists "Wyniki diagnozy: odczyt tylko admin" on diagnosis_results;
create policy "Wyniki diagnozy: odczyt tylko admin"
  on diagnosis_results for select
  using (is_admin());

drop policy if exists "Wyniki diagnozy: usuwanie tylko admin" on diagnosis_results;
create policy "Wyniki diagnozy: usuwanie tylko admin"
  on diagnosis_results for delete
  using (is_admin());

-- --------------------------------------------------------------------------
-- 16b) KOLUMNY DLA CELU NAUKI I SERII DNI Z RZĘDU (dopisek do sekcji 16)
-- --------------------------------------------------------------------------
alter table diagnosis_codes add column if not exists goal_text text not null default '';
alter table diagnosis_codes add column if not exists last_visit_date date;
alter table diagnosis_codes add column if not exists streak_count int not null default 0;

-- --------------------------------------------------------------------------
-- 17) PANEL KURSANTA — get_student_portal_data (dopisek do sekcji 16 wyżej)
-- --------------------------------------------------------------------------
drop function if exists get_student_portal_data(text);

create function get_student_portal_data(p_code text)
returns table(student_name text, results jsonb, lessons jsonb, goal_text text, streak_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_name text;
  v_goal text;
  v_last_visit date;
  v_streak int;
begin
  select dc.id, dc.student_name, dc.goal_text, dc.last_visit_date, dc.streak_count
    into v_id, v_name, v_goal, v_last_visit, v_streak
  from diagnosis_codes dc
  where upper(dc.code) = upper(p_code) and dc.active = true;

  if v_name is null then
    return;
  end if;

  if v_last_visit is null or v_last_visit < current_date - 1 then
    v_streak := 1;
  elsif v_last_visit = current_date - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  end if;

  update diagnosis_codes
  set last_visit_date = current_date, streak_count = v_streak
  where id = v_id;

  return query
  select
    v_name,
    coalesce((
      select jsonb_agg(to_jsonb(res) order by res.created_at desc)
      from (
        select id, test_type, levels, report_text, created_at
        from diagnosis_results
        where code = p_code
      ) res
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(les) order by les.lesson_date asc, les.lesson_time asc)
      from (
        select id, lesson_date, lesson_time, duration_minutes, status
        from lesson_schedule
        where lower(trim(lesson_schedule.student_name)) = lower(trim(v_name))
          and lesson_date >= current_date
          and status = 'planned'
      ) les
    ), '[]'::jsonb),
    v_goal,
    v_streak;
end;
$$;

grant execute on function get_student_portal_data(text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 18) CYTATY MOTYWUJĄCE — motivational_quotes (rotacja w panelu kursanta)
-- --------------------------------------------------------------------------
create table if not exists motivational_quotes (
  id bigint generated always as identity primary key,
  quote_text text not null default '',
  author text not null default '',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table motivational_quotes enable row level security;

drop policy if exists "Cytaty: publiczny odczyt opublikowanych" on motivational_quotes;
create policy "Cytaty: publiczny odczyt opublikowanych"
  on motivational_quotes for select
  using (published = true);

drop policy if exists "Cytaty: pełny dostęp admina" on motivational_quotes;
create policy "Cytaty: pełny dostęp admina"
  on motivational_quotes for all
  using (is_admin())
  with check (is_admin());

insert into motivational_quotes (quote_text, author, sort_order)
select * from (values
  ('Kto nie zna języków obcych, nie wie nic o własnym.', 'Johann Wolfgang von Goethe', 1),
  ('Gdy raz nauczysz się czytać, będziesz już na zawsze wolny.', 'Frederick Douglass', 2),
  ('Wiedza jest bezwartościowa, dopóki nie wcielisz jej w życie.', 'Anton Czechow', 3),
  ('Język jest mapą kultury. Mówi, skąd przybyli jej ludzie i dokąd zmierzają.', 'Rita Mae Brown', 4),
  ('Język jest krwią duszy, w której rodzą się i rosną myśli.', 'Oliver Wendell Holmes', 5),
  ('Żaden przyjaciel nie jest tak wierny jak książka.', 'Ernest Hemingway', 6),
  ('Czytelnik przeżywa tysiąc żyć, zanim umrze. Ten, kto nigdy nie czyta, przeżywa tylko jedno.', 'George R.R. Martin', 7),
  ('Rób, co możesz, dopóki nie wiesz lepiej. Gdy już wiesz lepiej — rób lepiej.', 'Maya Angelou', 8),
  ('Nigdy nie jest się za starym, by wyznaczyć sobie nowy cel albo zamarzyć na nowo.', 'C.S. Lewis', 9),
  ('Doświadczenie to imię, jakie każdy nadaje swoim błędom.', 'Oscar Wilde', 10),
  ('Dwoma najpotężniejszymi wojownikami są cierpliwość i czas.', 'Lew Tołstoj', 11),
  ('Osądzaj człowieka po jego pytaniach, a nie po odpowiedziach.', 'Wolter', 12),
  ('Znajomość języków jest bramą do mądrości.', 'Roger Bacon', 13),
  ('Mówić danym językiem — to przyjąć cały świat, całą kulturę.', 'Frantz Fanon', 14),
  ('Im więcej czytasz, tym więcej wiesz. Im więcej się uczysz, tym dalej zajdziesz.', 'Dr. Seuss', 15),
  ('Słowo „nie wiem" jest małe, ale lata na mocnych skrzydłach.', 'Wisława Szymborska', 16),
  ('Człowiek, który nie czyta, nie ma żadnej przewagi nad tym, kto czytać nie potrafi.', 'Mark Twain', 17),
  ('Zawsze wyobrażałem sobie raj jako rodzaj biblioteki.', 'Jorge Luis Borges', 18)
) as seed(quote_text, author, sort_order)
where not exists (select 1 from motivational_quotes);

-- --------------------------------------------------------------------------
-- 19) CEL NAUKI I SERIA DNI Z RZĘDU (dopisek do sekcji 16/17 — panel kursanta)
-- --------------------------------------------------------------------------
create or replace function update_student_goal(p_code text, p_goal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update diagnosis_codes
  set goal_text = left(coalesce(p_goal, ''), 300)
  where upper(code) = upper(p_code) and active = true;
  return found;
end;
$$;

grant execute on function update_student_goal(text, text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 20) GRA NA ROZGRZEWKĘ — letter_game_days (panel kursanta)
-- --------------------------------------------------------------------------
create table if not exists letter_game_days (
  id bigint generated always as identity primary key,
  letters text not null default '',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table letter_game_days enable row level security;

drop policy if exists "Gra w litery: publiczny odczyt opublikowanych" on letter_game_days;
create policy "Gra w litery: publiczny odczyt opublikowanych"
  on letter_game_days for select
  using (published = true);

drop policy if exists "Gra w litery: pełny dostęp admina" on letter_game_days;
create policy "Gra w litery: pełny dostęp admina"
  on letter_game_days for all
  using (is_admin())
  with check (is_admin());

insert into letter_game_days (letters, sort_order)
select * from (values
  ('TEACHERS', 1),
  ('LANGUAGE', 2),
  ('STUDENTS', 3),
  ('GRAMMAR', 4),
  ('LISTENING', 5),
  ('VOCABULARY', 6)
) as seed(letters, sort_order)
where not exists (select 1 from letter_game_days);

-- --------------------------------------------------------------------------
-- 21) AVATAR KURSANTA (dopisek do sekcji 16/17 — panel kursanta)
-- --------------------------------------------------------------------------
alter table diagnosis_codes add column if not exists avatar_data_url text not null default '';

drop function if exists get_student_portal_data(text);

create function get_student_portal_data(p_code text)
returns table(student_name text, results jsonb, lessons jsonb, goal_text text, streak_count int, avatar_data_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_name text;
  v_goal text;
  v_last_visit date;
  v_streak int;
  v_avatar text;
begin
  select dc.id, dc.student_name, dc.goal_text, dc.last_visit_date, dc.streak_count, dc.avatar_data_url
    into v_id, v_name, v_goal, v_last_visit, v_streak, v_avatar
  from diagnosis_codes dc
  where upper(dc.code) = upper(p_code) and dc.active = true;

  if v_name is null then
    return;
  end if;

  if v_last_visit is null or v_last_visit < current_date - 1 then
    v_streak := 1;
  elsif v_last_visit = current_date - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  end if;

  update diagnosis_codes
  set last_visit_date = current_date, streak_count = v_streak
  where id = v_id;

  return query
  select
    v_name,
    coalesce((
      select jsonb_agg(to_jsonb(res) order by res.created_at desc)
      from (
        select id, test_type, levels, report_text, created_at
        from diagnosis_results
        where code = p_code
      ) res
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(les) order by les.lesson_date asc, les.lesson_time asc)
      from (
        select id, lesson_date, lesson_time, duration_minutes, status
        from lesson_schedule
        where lower(trim(lesson_schedule.student_name)) = lower(trim(v_name))
          and lesson_date >= current_date
          and status = 'planned'
      ) les
    ), '[]'::jsonb),
    v_goal,
    v_streak,
    v_avatar;
end;
$$;

grant execute on function get_student_portal_data(text) to anon, authenticated;

create or replace function update_student_avatar(p_code text, p_avatar_data_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update diagnosis_codes
  set avatar_data_url = left(coalesce(p_avatar_data_url, ''), 200000)
  where upper(code) = upper(p_code) and active = true;
  return found;
end;
$$;

grant execute on function update_student_avatar(text, text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 22) STAWKI INDYWIDUALNE KURSANTÓW — student_rates (dopisek do sekcji 10)
-- --------------------------------------------------------------------------
create table if not exists student_rates (
  id bigint generated always as identity primary key,
  student_name text not null default '',
  hourly_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists student_rates_unique_name
  on student_rates (lower(trim(student_name)));

alter table student_rates enable row level security;

drop policy if exists "Stawki kursantów: tylko administrator" on student_rates;
create policy "Stawki kursantów: tylko administrator"
  on student_rates for all
  using (is_admin())
  with check (is_admin());

-- --------------------------------------------------------------------------
-- 23) MÓJ ZESZYT KURSANTA — student_notebook_entries (dopisek do sekcji 16/17)
-- --------------------------------------------------------------------------
create table if not exists student_notebook_entries (
  id bigint generated always as identity primary key,
  code text not null,
  entry_type text not null default 'notatka', -- 'slowko' | 'blad' | 'zwrot' | 'notatka'
  title text not null default '',
  body text not null default '',
  example_sentence text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists student_notebook_entries_code_idx
  on student_notebook_entries (upper(code));

alter table student_notebook_entries enable row level security;

drop policy if exists "Zeszyt kursanta: pelny dostep tylko admin" on student_notebook_entries;
create policy "Zeszyt kursanta: pelny dostep tylko admin"
  on student_notebook_entries for all
  using (is_admin())
  with check (is_admin());

create or replace function get_notebook_entries(p_code text)
returns setof student_notebook_entries
language sql
security definer
set search_path = public
as $$
  select n.*
  from student_notebook_entries n
  where upper(n.code) = upper(p_code)
    and exists (
      select 1 from diagnosis_codes d
      where upper(d.code) = upper(p_code) and d.active = true
    )
  order by n.created_at desc;
$$;

grant execute on function get_notebook_entries(text) to anon, authenticated;

create or replace function add_notebook_entry(
  p_code text, p_entry_type text, p_title text, p_body text, p_example_sentence text
)
returns student_notebook_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_notebook_entries;
begin
  if not exists (select 1 from diagnosis_codes where upper(code) = upper(p_code) and active = true) then
    raise exception 'Nieprawidlowy lub nieaktywny kod dostepu.';
  end if;

  insert into student_notebook_entries (code, entry_type, title, body, example_sentence)
  values (
    p_code,
    coalesce(nullif(trim(p_entry_type), ''), 'notatka'),
    left(coalesce(p_title, ''), 200),
    left(coalesce(p_body, ''), 2000),
    left(coalesce(p_example_sentence, ''), 500)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function add_notebook_entry(text, text, text, text, text) to anon, authenticated;

create or replace function update_notebook_entry(
  p_code text, p_id bigint, p_title text, p_body text, p_example_sentence text
)
returns student_notebook_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_notebook_entries;
begin
  update student_notebook_entries
  set title = left(coalesce(p_title, ''), 200),
      body = left(coalesce(p_body, ''), 2000),
      example_sentence = left(coalesce(p_example_sentence, ''), 500)
  where id = p_id and upper(code) = upper(p_code)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function update_notebook_entry(text, bigint, text, text, text) to anon, authenticated;

create or replace function delete_notebook_entry(p_code text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from student_notebook_entries
  where id = p_id and upper(code) = upper(p_code);
end;
$$;

grant execute on function delete_notebook_entry(text, bigint) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 24) TŁUMACZENIA — translation_pricing
-- --------------------------------------------------------------------------
create table if not exists translation_pricing (
  id bigint generated always as identity primary key,
  category_key text not null unique,
  category_label text not null,
  description text not null default '',
  page_size_chars int not null default 1800,
  price_per_page numeric(10,2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table translation_pricing enable row level security;

drop policy if exists "Cennik tłumaczeń: publiczny odczyt" on translation_pricing;
create policy "Cennik tłumaczeń: publiczny odczyt"
  on translation_pricing for select
  using (true);

drop policy if exists "Cennik tłumaczeń: zapis tylko dla administratora" on translation_pricing;
create policy "Cennik tłumaczeń: zapis tylko dla administratora"
  on translation_pricing for all
  using (is_admin())
  with check (is_admin());

insert into translation_pricing (category_key, category_label, description, page_size_chars, price_per_page, sort_order)
select * from (values
  ('zwykle', 'Tłumaczenia zwykłe', 'Teksty ogólne, korespondencja, proste dokumenty bez specjalistycznej terminologii.', 1800, 0::numeric, 1),
  ('przysiegle', 'Tłumaczenia przysięgłe', 'Dokumenty urzędowe wymagające uwierzytelnienia: akty, świadectwa, dyplomy, umowy do urzędu lub sądu.', 1125, 0::numeric, 2),
  ('specjalistyczne', 'Tłumaczenia specjalistyczne', 'Teksty techniczne, prawnicze, medyczne i finansowe wymagające specjalistycznej terminologii.', 1800, 0::numeric, 3),
  ('marketingowe', 'Tłumaczenia marketingowe i CV', 'CV, listy motywacyjne, opisy produktów, treści reklamowe i strony internetowe.', 1800, 0::numeric, 4)
) as seed(category_key, category_label, description, page_size_chars, price_per_page, sort_order)
where not exists (select 1 from translation_pricing);

-- --------------------------------------------------------------------------
-- 25) TREŚCI STRONY GŁÓWNEJ — HERO (dopisek do sekcji 4 — site_content)
-- --------------------------------------------------------------------------
-- Trzy nowe pola edytowalne w panelu (zakładka "Treści stron"): mały
-- nagłówek nad tytułem (eyebrow), główny tytuł (H1) i akapit wstępu (lead)
-- w sekcji hero strony głównej. Wartości startowe odpowiadają dokładnie
-- temu, co dziś jest na sztywno wpisane w index.html — więc podmiana nie
-- zmienia niczego na stronie, dopóki administrator sam czegoś nie
-- zedytuje. Osobny insert (jak przy "tlumaczenia"/"webinary" wyżej), żeby
-- nie zaburzać numeracji sort_order istniejących wierszy w sekcji 4.
insert into site_content (key, label, value, input_type, sort_order) values
  ('index_hero_eyebrow', 'Strona główna — hero, mały nagłówek nad tytułem', 'Kursy języka angielskiego dla dorosłych i młodzieży', 'text', 9),
  ('index_hero_title', 'Strona główna — hero, główny tytuł (H1)', 'Mów po angielsku tak, żeby naprawdę być zrozumianym.', 'text', 10),
  ('index_hero_lead', 'Strona główna — hero, akapit wstępu pod tytułem', 'Kurs dla dorosłych, młodzieży i studentów, którzy znają już podstawy, ale wciąż brakuje im pewności siebie w rozmowie. Pracujemy nad swobodą mówienia i pewnością siebie — nie nad kolejnym testem gramatycznym.', 'textarea', 11)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- 26) WIDOCZNOŚĆ SEKCJI „CO MÓWIĄ KURSANCI” NA STRONIE GŁÓWNEJ (dopisek do
-- sekcji 12 — nav_visibility)
-- --------------------------------------------------------------------------
-- Działa tym samym mechanizmem co pozostałe przełączniki w nav_visibility,
-- ale ten klucz nie odpowiada osobnej podstronie — wyłączenie go chowa
-- tylko sekcję „Co mówią kursanci” na index.html (patrz js/site-content.js,
-- SECTION_ELEMENT_BY_KEY), reszta strony głównej zostaje bez zmian.
insert into nav_visibility (page_key, label, sort_order) values
  ('index-testimonials', 'Sekcja "Co mówią kursanci" (strona główna)', 10)
on conflict (page_key) do nothing;

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
