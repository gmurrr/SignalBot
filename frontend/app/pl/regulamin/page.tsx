import type { Metadata } from "next";

import { TermsDocumentPage } from "@/components/legal/terms-document-page";
import { LEGAL_LINKS, TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Regulamin świadczenia usług drogą elektroniczną | Zeta Signals",
  description: "Regulamin serwisu Zeta Signals, informacje o subskrypcji, ryzyku rynkowym i charakterze edukacyjno-informacyjnym usługi.",
  alternates: {
    canonical: "/pl/regulamin",
    languages: {
      en: "/en/terms",
      pl: "/pl/regulamin"
    }
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function PolishTermsPage() {
  return (
    <TermsDocumentPage
      boxText="Dokument zawiera warunki korzystania z Serwisu, informacje o subskrypcji, ryzyku rynkowym oraz charakterze edukacyjno-informacyjnym usługi."
      downloadLabel="Pobierz regulamin PDF"
      effectiveDateLabel={`Data wejścia w życie: ${TERMS_EFFECTIVE_DATE}`}
      fileName="regulamin-zeta-signals-tekst.md"
      languageLabel="Język: PL"
      pdfHref={LEGAL_LINKS.termsPdf}
      title="Regulamin świadczenia usług drogą elektroniczną serwisu Zeta Signals"
      versionLabel={`Wersja: ${TERMS_VERSION}`}
    />
  );
}
