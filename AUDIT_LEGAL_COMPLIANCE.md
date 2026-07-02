# AUDIT_LEGAL_COMPLIANCE.md

Data audytu technicznego: 07.06.2026

Ten dokument opisuje techniczny audyt zgodności aplikacji Zeta Signals po stronie kodu, routingu, zgód, plików PDF i integracji płatności. Nie stanowi porady prawnej. Treść dokumentów prawnych powinna zostać ostatecznie zatwierdzona przez prawnika.

## Status ogólny

Status: częściowo gotowe technicznie, z ręcznymi krokami produkcyjnymi.

W kodzie poprawiono krytyczne braki dotyczące dat dokumentów, finalnych PDF-ów, checkboxów rejestracji, checkboxów checkoutu, zapisu zgód oraz podpisu webhooka Lemon Squeezy. Supabase ma teraz jeden kompletny plik `supabase/schema.sql` do postawienia czystej bazy od zera.

## Poprawione w kodzie

- Ustawiono finalne wersje i daty dokumentów: Regulamin 1.1, Privacy Policy 1.2, Cookie Policy 1.1, data 07.06.2026.
- Podmieniono linki PDF na finalne nazwy plików:
  - `regulamin-zeta-signals-pl-v1-1-final.pdf`
  - `terms-zeta-signals-en-v1-1-final.pdf`
  - `polityka-prywatnosci-zeta-signals-pl-v1-2-final.pdf`
  - `privacy-policy-zeta-signals-en-v1-2-final.pdf`
  - `polityka-cookies-zeta-signals-pl-v1-1-final.pdf`
  - `cookie-policy-zeta-signals-en-v1-1-final.pdf`
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
- Webhook Lemon Squeezy weryfikuje teraz `X-Signature` przez HMAC SHA-256 z `BILLING_WEBHOOK_SECRET`.
- Checkout Lemon Squeezy przekazuje `checkout[custom][user_id]`, `checkout[custom][plan_code]` i `checkout[custom][reference]`, aby dane wracały w `meta.custom_data` webhooków.
- Payload Lemon Squeezy odkładany w `payment_events` jest zminimalizowany do technicznych pól potrzebnych do audytu i synchronizacji, zamiast pełnego payloadu płatności.
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
- Strona Regulaminu pokazuje wersję 1.1, datę 07.06.2026 i finalny link PDF.
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

### Lemon Squeezy

- Ustawić `BILLING_PROVIDER=lemon_squeezy`.
- Ustawić `BILLING_CHECKOUT_URL` jako shareable URL w formacie `/checkout/buy/[VARIANT_ID]`, nie jako podpisany cart URL.
- Ustawić webhook URL:
  - `https://www.zetasignals.pl/api/billing/webhook/lemon_squeezy`
- Ustawić `BILLING_WEBHOOK_SECRET` na dokładnie ten sam signing secret, który jest skonfigurowany w Lemon Squeezy.
- Włączyć co najmniej zdarzenia subskrypcyjne potrzebne do synchronizacji dostępu:
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_resumed`
  - `subscription_expired`
  - `subscription_paused`
  - `subscription_unpaused`
  - `subscription_payment_failed`
  - `subscription_payment_success`
  - `subscription_payment_recovered`
- Wykonać sandboxową symulację webhooka i potwierdzić, że subskrypcja użytkownika przechodzi na właściwy status.
- Skonfigurować w Lemon Squeezy redirect/confirmation button do `https://www.zetasignals.pl/billing?checkout=success`, jeżeli flow ma automatycznie wracać do aplikacji po płatności.

### Cloudflare / hosting

- Potwierdzić HTTPS i canonical host `https://www.zetasignals.pl`.
- Wyłączyć cache/challenge dla `/api/billing/webhook/lemon_squeezy`, aby webhook Lemon Squeezy nie był blokowany.
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
- Finalne PDF-y zostały dodane jako kopie aktualnych istniejących PDF-ów z nazwą `-final`. Jeżeli treść dokumentów prawnych zmieni się po tej dacie, PDF-y trzeba wygenerować ponownie i utrzymać zgodność wersji.

## Źródła zewnętrzne użyte do weryfikacji Lemon Squeezy

- https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
- https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
