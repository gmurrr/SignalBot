import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { RiskDisclaimer } from "@/components/legal/risk-disclaimer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LEGAL_LINKS, SUBSCRIPTION_RENEWAL_NOTICE } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Cennik | Zeta Signals",
  description: "Cennik subskrypcji Zeta Signals Premium oraz informacje o automatycznym odnawianiu i ryzyku rynkowym."
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 lg:px-10">
        <section className="border-b border-[#1A1A1A] pb-8">
          <p className="text-xs uppercase tracking-[0.32em] text-brass">Cennik</p>
          <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">
            Zeta Signals Premium
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-muted">
            Miesięczna subskrypcja daje dostęp do Realtime Cockpit oraz Alertów Analitycznych XAU/USD po potwierdzeniu płatności przez Lemon Squeezy albo skonfigurowanego Operatora Płatności.
          </p>
        </section>

        <RiskDisclaimer />

        <Card className="border-[#1A1A1A]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-brass">Subskrypcja miesięczna</p>
              <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">Realtime Cockpit</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{SUBSCRIPTION_RENEWAL_NOTICE}</p>
            </div>
            <Button asChild>
              <Link href="/auth/sign-up">
                Rozpocznij
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Separator className="my-8" />
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <Link href={LEGAL_LINKS.terms} className="text-brass transition-colors hover:text-[#e6c55a]">
              Regulamin
            </Link>
            <Link href={LEGAL_LINKS.riskWarning} className="text-brass transition-colors hover:text-[#e6c55a]">
              Ostrzeżenie o ryzyku
            </Link>
            <Link href={LEGAL_LINKS.privacy} className="text-brass transition-colors hover:text-[#e6c55a]">
              Polityka prywatności
            </Link>
          </div>
        </Card>
      </main>
    </>
  );
}
