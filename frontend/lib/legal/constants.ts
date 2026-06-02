export const TERMS_VERSION = "1.1";
export const TERMS_EFFECTIVE_DATE = "[data]";
export const PRIVACY_VERSION = "1.1";
export const PRIVACY_EFFECTIVE_DATE = "[data]";
export const PRIVACY_EFFECTIVE_DATE_EN = "[date]";
export const COOKIE_POLICY_VERSION = "1.1";
export const COOKIE_POLICY_EFFECTIVE_DATE = "[data]";
export const COOKIE_POLICY_EFFECTIVE_DATE_EN = "[date]";
export const RISK_WARNING_VERSION = "1.0";
export const WITHDRAWAL_CONSENT_VERSION = "1.0";
export const SUBSCRIPTION_RENEWAL_CONSENT_VERSION = "1.0";

export const LEGAL_DOCUMENTS = {
  effectiveDate: TERMS_EFFECTIVE_DATE,
  cookiePolicyEffectiveDate: COOKIE_POLICY_EFFECTIVE_DATE,
  cookiePolicyVersion: COOKIE_POLICY_VERSION,
  privacyPolicyEffectiveDate: PRIVACY_EFFECTIVE_DATE,
  privacyPolicyVersion: PRIVACY_VERSION,
  riskWarningVersion: RISK_WARNING_VERSION,
  subscriptionRenewalConsentVersion: SUBSCRIPTION_RENEWAL_CONSENT_VERSION,
  termsVersion: TERMS_VERSION,
  withdrawalConsentVersion: WITHDRAWAL_CONSENT_VERSION
} as const;

export const LEGAL_LINKS = {
  cookie: "/pl/polityka-cookies",
  cookiePdf: "/files/polityka-cookies-zeta-signals-pl-v1-1.pdf",
  cookiePdfEn: "/files/cookie-policy-zeta-signals-en-v1-1.pdf",
  enCookie: "/en/cookie-policy",
  contact: "mailto:contact@zetasignals.com",
  enPrivacy: "/en/privacy-policy",
  enRiskWarning: "/en/risk-warning",
  enTerms: "/en/terms",
  plPrivacy: "/pl/polityka-prywatnosci",
  plRiskWarning: "/pl/ostrzezenie-o-ryzyku",
  plTerms: "/pl/regulamin",
  plCookie: "/pl/polityka-cookies",
  privacy: "/pl/polityka-prywatnosci",
  riskWarning: "/pl/ostrzezenie-o-ryzyku",
  subscriptionManagement: "/billing",
  terms: "/pl/regulamin",
  privacyPdf: "/files/polityka-prywatnosci-zeta-signals-pl-v1-1.pdf",
  privacyPdfEn: "/files/privacy-policy-zeta-signals-en-v1-1.pdf",
  termsPdf: "/files/regulamin-zeta-signals-pl-v1-1.pdf",
  termsPdfEn: "/files/terms-zeta-signals-en-v1-1.pdf"
} as const;

export const PUBLIC_RISK_DISCLAIMER =
  "Zeta Signals nie jest doradcą inwestycyjnym ani brokerem. Alerty Analityczne mają charakter edukacyjno-informacyjny. Handel Forex/CFD/XAU/USD wiąże się z wysokim ryzykiem utraty kapitału. Wyniki historyczne nie gwarantują przyszłych wyników.";

export const FULL_RISK_WARNING =
  "Zeta Signals jest narzędziem analitycznym o charakterze edukacyjno-informacyjnym. Serwis nie świadczy doradztwa inwestycyjnego, nie jest brokerem, nie zarządza kapitałem i nie wykonuje zleceń. Handel Forex/CFD/XAU/USD wiąże się z wysokim ryzykiem utraty kapitału. Wyniki historyczne, statystyki i Alerty Analityczne nie gwarantują przyszłych wyników. Wszystkie decyzje inwestycyjne użytkownik podejmuje samodzielnie i na własne ryzyko.";

export const FULL_RISK_WARNING_EN =
  "Zeta Signals does not provide investment advice, financial recommendations, brokerage services or capital management. Trading Forex/CFD/XAU/USD involves a high risk of losing capital. Analytical Alerts are educational and informational only. Past performance does not guarantee future results.";

export const FULL_RISK_WARNING_PL =
  "Zeta Signals nie świadczy doradztwa inwestycyjnego, rekomendacji finansowych, usług brokerskich ani zarządzania kapitałem. Handel Forex/CFD/XAU/USD wiąże się z wysokim ryzykiem utraty kapitału. Alerty Analityczne mają charakter wyłącznie edukacyjno-informacyjny. Wyniki historyczne nie gwarantują przyszłych rezultatów.";

export const SUBSCRIPTION_RENEWAL_NOTICE =
  "Subskrypcja odnawia się automatycznie co miesiąc. Możesz ją anulować w dowolnym momencie, zachowując dostęp do końca opłaconego okresu.";

export const CHECKOUT_CONSENT_TEXT = {
  digitalService:
    "Wyrażam wyraźną zgodę na rozpoczęcie świadczenia usługi cyfrowej i dostarczania treści cyfrowych przed upływem 14-dniowego terminu odstąpienia od umowy oraz przyjmuję do wiadomości, że po aktywacji dostępu do płatnych funkcji Serwisu tracę prawo odstąpienia od umowy w zakresie przewidzianym przepisami prawa.",
  renewal:
    "Przyjmuję do wiadomości, że Subskrypcja odnawia się automatycznie co miesiąc do czasu jej anulowania, a anulowanie Subskrypcji powoduje zachowanie dostępu do końca opłaconego okresu rozliczeniowego bez proporcjonalnego zwrotu opłaty, chyba że bezwzględnie obowiązujące przepisy prawa stanowią inaczej.",
  risk:
    "Oświadczam, że rozumiem, iż Zeta Signals nie świadczy doradztwa inwestycyjnego, a Alerty Analityczne mają charakter wyłącznie edukacyjno-informacyjny. Rozumiem, że handel na rynku Forex/CFD/XAU/USD wiąże się z wysokim ryzykiem utraty kapitału, a wszelkie decyzje inwestycyjne podejmuję samodzielnie i na własne ryzyko.",
  terms: "Oświadczam, że zapoznałem/am się z Regulaminem Zeta Signals oraz akceptuję jego treść."
} as const;

export const CHECKOUT_CONSENT_TEXT_EN = {
  digitalService:
    "I expressly consent to the commencement of the digital service and the supply of digital content before the expiry of the 14-day withdrawal period and acknowledge that, after activation of access to the paid functions of the Service, I lose the right of withdrawal from the agreement to the extent provided by law.",
  renewal:
    "I acknowledge that the Subscription renews automatically every month until cancelled, and that cancellation of the Subscription results in access being retained until the end of the paid billing period without a pro-rata refund, unless mandatory provisions of law provide otherwise.",
  risk:
    "I declare that I understand that Zeta Signals does not provide investment advice and that Analytical Alerts are exclusively educational and informational in nature. I understand that trading Forex/CFD/XAU/USD involves a high risk of losing capital and that I make all investment decisions independently and at my own risk.",
  terms: "I declare that I have read the Zeta Signals Terms of Service and accept their content."
} as const;

export function getLocalizedLegalLinks(language: "PL" | "EN") {
  return language === "EN"
    ? {
        privacy: LEGAL_LINKS.enPrivacy,
        cookie: LEGAL_LINKS.enCookie,
        cookiePdf: LEGAL_LINKS.cookiePdfEn,
        privacyPdf: LEGAL_LINKS.privacyPdfEn,
        riskWarning: LEGAL_LINKS.enRiskWarning,
        terms: LEGAL_LINKS.enTerms,
        termsPdf: LEGAL_LINKS.termsPdfEn
      }
    : {
        privacy: LEGAL_LINKS.plPrivacy,
        cookie: LEGAL_LINKS.plCookie,
        cookiePdf: LEGAL_LINKS.cookiePdf,
        privacyPdf: LEGAL_LINKS.privacyPdf,
        riskWarning: LEGAL_LINKS.plRiskWarning,
        terms: LEGAL_LINKS.plTerms,
        termsPdf: LEGAL_LINKS.termsPdf
      };
}
