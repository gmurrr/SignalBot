import { AccessGate } from "@/components/auth/access-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SiteHeader } from "@/components/site-header";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <AccessGate requireSubscription>
        <DashboardShell />
      </AccessGate>
    </>
  );
}
