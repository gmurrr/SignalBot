import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Zgłoszenie dostępu premium"
      subtitle="Ekran rejestracji jest przygotowany pod płatny onboarding, potwierdzenie zakupu oraz obsługę zaproszeń do Zeta Signals."
      cta="Utwórz zgłoszenie"
      footerLabel="Masz już dostęp?"
      footerHref="/auth/sign-in"
      footerText="Zaloguj się"
    />
  );
}
