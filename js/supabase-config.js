/* ==========================================================================
   OwnEnglish — konfiguracja Supabase
   Podmień poniższe dwie wartości na dane swojego projektu:
   Supabase Dashboard → Project Settings → API → "Project URL" i "anon public".
   To jest klucz PUBLICZNY — jego umieszczenie w kodzie strony jest bezpieczne
   i zamierzone (prawdziwa ochrona zapisu danych jest ustawiona w bazie,
   patrz supabase-setup.sql). Nigdy nie wklejaj tu klucza "service_role"
   (tajnego) — ten musi zostać wyłącznie w panelu Supabase.

   Dopóki poniższe wartości pozostają placeholderami, cała strona działa
   normalnie na statycznej treści wpisanej w plikach HTML — nic się nie
   psuje. Panel admina (admin.html) i dynamiczna treść (cennik, opinie,
   dane kontaktowe) zaczną działać dopiero po wpisaniu tu prawdziwych danych.
   ========================================================================== */

window.SUPABASE_URL = 'https://TWOJ-PROJEKT.supabase.co'; // TODO: podmień
window.SUPABASE_ANON_KEY = 'TWOJ-ANON-PUBLIC-KEY'; // TODO: podmień
