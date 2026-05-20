import { PasswordRecoveryShell } from "@/components/auth/password-recovery-shell";
import { SiteHeader } from "@/components/site-header";

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <PasswordRecoveryShell mode="reset" />
    </>
  );
}
