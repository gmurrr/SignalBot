import { PasswordRecoveryShell } from "@/components/auth/password-recovery-shell";
import { SiteHeader } from "@/components/site-header";

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <PasswordRecoveryShell mode="request" />
    </>
  );
}
