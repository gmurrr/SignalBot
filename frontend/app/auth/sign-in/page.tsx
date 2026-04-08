import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      title="Desk Sign In"
      subtitle="Secure access to the private XAU/USD dashboard with room for EasyCart-based entitlement checks."
      cta="Enter Dashboard"
      footerLabel="Need a new account?"
      footerHref="/auth/sign-up"
      footerText="Request access"
    />
  );
}
