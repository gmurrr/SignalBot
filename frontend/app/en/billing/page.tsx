import { AccessGate } from "@/components/auth/access-gate";
import { BillingShell } from "@/components/billing/billing-shell";
import { SiteHeader } from "@/components/site-header";

export default function EnglishBillingPage() {
  return (
    <>
      <SiteHeader />
      <AccessGate>
        <BillingShell />
      </AccessGate>
    </>
  );
}
