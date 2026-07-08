# AUDIT_LEGAL_COMPLIANCE.md

Data audytu technicznego: 08.07.2026

Ten dokument opisuje techniczny audyt zgodności aplikacji Zeta Signals po stronie kodu, routingu, zgód, plików PDF i integracji płatności. Nie stanowi porady prawnej. Treść dokumentów prawnych powinna zostać ostatecznie zatwierdzona przez prawnika.

## Status ogólny

Status: częściowo gotowe technicznie, z ręcznymi krokami produkcyjnymi.

W kodzie poprawiono krytyczne braki dotyczące dat dokumentów, finalnych PDF-ów, checkboxów rejestracji, checkboxów checkoutu, zapisu zgód oraz neutralnego modelu integracji płatności. Supabase ma teraz jeden kompletny plik `supabase/schema.sql` do postawienia czystej bazy od zera.

## Poprawione w kodzie

- Ustawiono finalne wersje i daty dokumentów: Regulamin 1.2, Privacy Policy 1.3, Cookie Policy 1.2, data 08.07.2026.
- Podmieniono linki PDF na finalne nazwy plików:
  - `regulamin-zeta-signals-pl-v1-2-final.pdf`
  - `terms-zeta-signals-en-v1-2-final.pdf`
  - `polityka-prywatnosci-zeta-signals-pl-v1-3-final.pdf`
  - `privacy-policy-zeta-signals-en-v1-3-final.pdf`
  - `polityka-cookies-zeta-signals-pl-v1-2-final.pdf`
  - `cookie-policy-zeta-signals-en-v1-2-final.pdf`
- Rejestracja wymaga teraz osobno:
  - akceptacji Regulaminu,
  - potwierdzenia zapoznania z Polityką Prywatności,
  - potwierdzenia wieku 18+.
- API rejestracji odrzuca request bez wszystkich trzech potwierdzeń i zapisuje metadane legal acceptance w Supabase Auth.
- Checkout wymaga teraz 5 osobnych potwierdzeń specyficznych dla zakupu:
  - ostrzeżenie o ryzyku,
  - brak doradztwa inwestycyjnego,
  - zgoda na natychmiastowe rozpoczęcie świadczenia usługi cyfrowej,
  - potwierdzenie możliwej utraty prawa odstąpienia,
  - automatyczne odnawianie subskrypcji.
- Endpointy checkoutu i mock aktywacji odrzucają request bez pełnego zestawu wymaganych zgód zakupowych oraz sprawdzają, czy konto ma aktualne zgody rejestracyjne: Regulamin, Polityka Prywatności i 18+.
- `user_consents` zapisuje zgody rejestracyjne tylko ze źródłem `REGISTER`, a przy checkoutcie dopisuje wyłącznie zgody zakupowe: `RISK_WARNING_ACCEPTANCE`, `NO_INVESTMENT_ADVICE_ACKNOWLEDGEMENT`, `DIGITAL_SERVICE_CONSENT`, `WITHDRAWAL_LOSS_ACKNOWLEDGEMENT`, `SUBSCRIPTION_RENEWAL_ACCEPTANCE`.
- `checkout_consent_audits` zapisuje rozszerzony ślad audytowy dla zgód zakupowych: timestampy, ryzyko, brak doradztwa, odstąpienie i subskrypcję. Nie zawiera już kolumn powielających zgody rejestracyjne.
- `supabase/schema.sql` jest teraz jedyną kompletną kwerendą do odtworzenia tabel, triggerów, funkcji, indeksów i RLS.
- Billing nie zawiera już adaptera konkretnego operatora; puste `BILLING_PROVIDER` daje stan `pending_payment_operator`.
- Generyczny webhook weryfikuje nagłówek `x-billing-webhook-secret` względem `BILLING_WEBHOOK_SECRET`.
- Generyczny checkout przekazuje neutralne parametry `user_id`, `email`, `plan_code`, `reference`, `success_url` i `cancel_url`.
- Pełny checkout URL z query stringiem nie jest już odkładany w audycie zgód; zapisywany jest oczyszczony URL bez parametrów.
- Błędy webhooka płatności są logowane po stronie serwera.
- `.env.local.example` nie zawiera już fikcyjnego checkout URL ani fikcyjnej publicznej domeny; publiczny URL ustawiono na `https://www.zetasignals.pl`.

## Zweryfikowane technicznie

- `npx tsc --noEmit`: OK.
- `npm run build`: OK.
- `git diff --check`: OK; tylko ostrzeżenia Git o przyszłej normalizacji LF -> CRLF.
- Skan krytycznych placeholderów w `frontend` i `supabase`: czysty dla atrap dat, tekstów wypełniających, starych fikcyjnych domen i starych fikcyjnych sekretów.
- Wszystkie trasy dokumentów prawnych zwracają `200`:
  - `/pl/regulamin`
  - `/en/terms`
  - `/pl/polityka-prywatnosci`
  - `/en/privacy-policy`
  - `/pl/polityka-cookies`
  - `/en/cookie-policy`
- Wszystkie finalne PDF-y zwracają `200` i `application/pdf`.
- Mobilna rejestracja na `390x844` pokazuje 3 checkboxy prawne, linkuje do Regulaminu i Polityki Prywatności oraz nie ma poziomego overflow.
- Strona Regulaminu pokazuje wersję 1.2, datę 08.07.2026 i finalny link PDF.
- Cookie banner jest widoczny i zawiera opcje zarządzania/odrzucenia/akceptacji.

## Ręczne kroki wymagane przed produkcją

### Supabase

- Po wyczyszczeniu bazy uruchomić kompletny plik `supabase/schema.sql` w SQL Editorze Supabase.
- Potwierdzić w Supabase Dashboard, że RLS jest aktywne dla:
  - `user_accounts`
  - `subscriptions`
  - `payment_events`
  - `account_security_events`
  - `user_consents`
  - `checkout_consent_audits`
- Potwierdzić, że `SUPABASE_SERVICE_ROLE_KEY` istnieje tylko w środowisku serwera i nigdy nie ma prefiksu `NEXT_PUBLIC_`.
- Przetestować rejestrację na koncie testowym i sprawdzić rekordy w `user_consents`.
- Przetestować checkout na koncie testowym i sprawdzić rekordy w `checkout_consent_audits` oraz `user_consents`.

### Operator płatności

- Wybrać operatora płatności i dopasować adapter checkoutu/webhooka do jego dokumentacji.
- Ustawić `BILLING_PROVIDER` na neutralną nazwę operatora, np. `stripe`, `paddle`, `payu`, `easycart` albo własną nazwę adaptera.
- Ustawić `BILLING_CHECKOUT_URL` dopiero po wyborze operatora i potwierdzeniu formatu tworzenia sesji checkout.
- Ustawić webhook URL w formacie:
  - `https://www.zetasignals.pl/api/billing/webhook/[provider]`
- Ustawić `BILLING_WEBHOOK_SECRET`; generyczny adapter oczekuje nagłówka `x-billing-webhook-secret`, a dla operatora z innym modelem podpisu trzeba dodać właściwą weryfikację.
- Włączyć zdarzenia subskrypcyjne potrzebne do synchronizacji dostępu zgodnie z dokumentacją wybranego operatora.
- Wykonać sandboxową symulację webhooka i potwierdzić, że subskrypcja użytkownika przechodzi na właściwy status.
- Skonfigurować redirect po płatności do `https://www.zetasignals.pl/billing?checkout=success`, jeżeli flow ma automatycznie wracać do aplikacji po płatności.

### Cloudflare / hosting

- Potwierdzić HTTPS i canonical host `https://www.zetasignals.pl`.
- Wyłączyć cache/challenge dla `/api/billing/webhook/*`, aby webhook operatora płatności nie był blokowany.
- Potwierdzić, że trasy `/pl/*`, `/en/*`, `/files/*.pdf` nie są błędnie przekierowywane ani blokowane.
- Potwierdzić, że security headers i przekierowania nie łamią checkoutu oraz callbacków Supabase Auth.

### Resend / e-mail

- Wysyłka maila potwierdzającego zakup nie jest jeszcze aktywna w kodzie. Moduł zwraca `sent: false` i `status: "not_configured"`.
- Przed produkcyjną wysyłką trzeba:
  - zweryfikować domenę/nadawcę w Resend,
  - ustawić `RESEND_API_KEY`,
  - użyć nadawcy typu `Zeta Signals <kontakt@zetasignals.pl>`,
  - podłączyć faktyczne wywołanie wysyłki po aktywacji subskrypcji w webhooku.

## Uwagi o treści i placeholderach

- Wystąpienia określeń opisujących wyniki próbne, symulacyjne i przykładowe w treściach prawnych zostały potraktowane jako znaczeniowe ostrzeżenia o wynikach historycznych. Nie są to teksty wypełniające ani fikcyjne dane.
- Finalne PDF-y zostały podmienione na wersje z paczki dokumentów z 08.07.2026. Jeżeli treść dokumentów prawnych zmieni się po tej dacie, PDF-y trzeba wygenerować ponownie i utrzymać zgodność wersji.
