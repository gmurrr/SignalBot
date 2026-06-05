import { getLocalizedLegalLinks } from "@/lib/legal/constants";

export type PurchaseConfirmationEmailInput = {
  billingCycle?: string | null;
  digitalAccessActivatedAt?: string | null;
  email: string;
  language?: "PL" | "EN";
  price?: string | null;
  provider?: string | null;
};

export async function sendPurchaseConfirmationEmail(input: PurchaseConfirmationEmailInput) {
  const message = buildPurchaseConfirmationEmail(input);

  // TODO: Connect a real transactional e-mail provider before enabling delivery.
  // Missing integration point: call the chosen e-mail provider from the billing webhook after subscription activation.
  return {
    legalLinks: getLocalizedLegalLinks(input.language ?? "PL"),
    message,
    sent: false,
    status: "not_configured" as const
  };
}

export function buildPurchaseConfirmationEmail(input: PurchaseConfirmationEmailInput) {
  return input.language === "EN" ? buildEnglishPurchaseConfirmationEmail(input) : buildPolishPurchaseConfirmationEmail(input);
}

function buildPolishPurchaseConfirmationEmail(input: PurchaseConfirmationEmailInput) {
  const links = getLocalizedLegalLinks("PL");
  const priceLine = input.price ? `Cena: ${input.price}` : "Cena: zgodnie z danymi Operatora Płatności";
  const cycleLine = input.billingCycle ? `Cykl subskrypcji: ${input.billingCycle}` : "Cykl subskrypcji: miesięczny, odnawiany automatycznie";
  const activationLine = input.digitalAccessActivatedAt
    ? `Dostęp do usługi cyfrowej został aktywowany: ${input.digitalAccessActivatedAt}`
    : "Dostęp do usługi cyfrowej został aktywowany po potwierdzeniu subskrypcji.";

  return {
    subject: "Potwierdzenie subskrypcji Zeta Signals",
    text: [
      "Usługa: Zeta Signals",
      priceLine,
      cycleLine,
      activationLine,
      `Regulamin: ${links.terms}`,
      `Regulamin PDF: ${links.termsPdf}`,
      `Polityka prywatności: ${links.privacy}`,
      `Polityka cookies: ${links.cookie}`,
      `Ostrzeżenie o ryzyku: ${links.riskWarning}`,
      "Potwierdzamy przyjęcie wymaganych zgód checkoutu, w tym zgody na rozpoczęcie świadczenia usługi cyfrowej przed upływem 14 dni oraz przyjęcie do wiadomości utraty prawa odstąpienia w zakresie przewidzianym prawem."
    ].join("\n")
  };
}

function buildEnglishPurchaseConfirmationEmail(input: PurchaseConfirmationEmailInput) {
  const links = getLocalizedLegalLinks("EN");
  const priceLine = input.price ? `Price: ${input.price}` : "Price: according to the Payment Operator data";
  const cycleLine = input.billingCycle ? `Subscription cycle: ${input.billingCycle}` : "Subscription cycle: monthly, automatically renewed";
  const activationLine = input.digitalAccessActivatedAt
    ? `Access to the digital service was activated: ${input.digitalAccessActivatedAt}`
    : "Access to the digital service was activated after subscription confirmation.";

  return {
    subject: "Zeta Signals subscription confirmation",
    text: [
      "Service: Zeta Signals",
      priceLine,
      cycleLine,
      activationLine,
      `Terms of Service: ${links.terms}`,
      `Terms PDF: ${links.termsPdf}`,
      `Privacy Policy: ${links.privacy}`,
      `Cookie Policy: ${links.cookie}`,
      `Risk Warning: ${links.riskWarning}`,
      "We confirm receipt of the required checkout consents, including consent to immediate provision of the digital service before the expiry of 14 days and acknowledgement of the possible loss of the right of withdrawal to the extent provided by law."
    ].join("\n")
  };
}
