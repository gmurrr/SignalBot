import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Private Access Request"
      subtitle="This registration screen is prepared for your premium onboarding flow, including billing confirmation and gated invite handling."
      cta="Create Access Request"
      footerLabel="Already onboarded?"
      footerHref="/auth/sign-in"
      footerText="Sign in"
    />
  );
}
