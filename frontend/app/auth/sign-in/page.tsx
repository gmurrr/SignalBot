import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      title="Logowanie / Rejestracja"
      subtitle="Bezpieczny dostęp do prywatnego panelu Zeta Signals dla XAU/USD, z miejscem na przyszłą walidację uprawnień przez EasyCart."
      cta="Wejdź do panelu"
      footerLabel="Nie masz jeszcze konta?"
      footerHref="/auth/sign-up"
      footerText="Poproś o dostęp"
    />
  );
}
