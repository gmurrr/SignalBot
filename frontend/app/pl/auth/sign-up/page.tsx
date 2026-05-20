import { AuthShell } from "@/components/auth/auth-shell";
import { SiteHeader } from "@/components/site-header";

export default function PolishSignUpPage() {
  return (
    <>
      <SiteHeader />
      <AuthShell mode="signUp" />
    </>
  );
}
