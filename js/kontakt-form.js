/* ==========================================================================
   OwnEnglish — formularze kontaktowe (rozwiązanie tymczasowe, bez backendu)
   Po kliknięciu "Wyślij" otwiera się program pocztowy użytkownika z gotową,
   wypełnioną wiadomością (mailto:) — działa od razu, bez konta w żadnym
   zewnętrznym systemie. To rozwiązanie przejściowe: gdy powstanie docelowy
   adres e-mail i/lub integracja z CRM, wystarczy podmienić MAILTO_ADDRESS
   poniżej (albo całkiem podmienić tę funkcję na prawdziwe wysyłanie).
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var MAILTO_ADDRESS = 'kontakt@ownenglish.pl'; // TODO: podmień na docelowy adres e-mail OwnEnglish

  function wireForm(formId, subject, fields) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var lines = fields.map(function (f) {
        var el = form.querySelector('[name="' + f.name + '"]');
        var value = el ? el.value.trim() : '';
        return f.label + ': ' + (value || '—');
      });

      var body = lines.join('\n');
      var mailto = 'mailto:' + MAILTO_ADDRESS +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      window.location.href = mailto;
    });
  }

  wireForm('form-indywidualny', 'Zapytanie o konsultację — OwnEnglish', [
    { name: 'ind-imie', label: 'Imię i nazwisko' },
    { name: 'ind-email', label: 'E-mail' },
    { name: 'ind-poziom', label: 'Poziom' },
    { name: 'ind-wiadomosc', label: 'Wiadomość' }
  ]);

  wireForm('form-firmowy', 'Zapytanie firmowe — OwnEnglish', [
    { name: 'firma-nazwa-k', label: 'Nazwa firmy' },
    { name: 'firma-email-k', label: 'E-mail służbowy' },
    { name: 'firma-osoby-k', label: 'Liczba osób' },
    { name: 'firma-wiadomosc-k', label: 'Wiadomość' }
  ]);

  wireForm('form-firmowy-dlafirm', 'Zapytanie firmowe — OwnEnglish', [
    { name: 'firma-nazwa', label: 'Nazwa firmy' },
    { name: 'firma-osoba', label: 'Osoba kontaktowa' },
    { name: 'firma-email', label: 'E-mail służbowy' },
    { name: 'firma-osoby', label: 'Liczba osób' },
    { name: 'firma-wiadomosc', label: 'Czego potrzebujecie' }
  ]);
});
