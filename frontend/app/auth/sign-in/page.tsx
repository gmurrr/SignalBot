import { AuthShell } from "@/components/auth/auth-shell";
import { SiteHeader } from "@/components/site-header";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <AuthShell mode="signIn" />
    </>
  );
}
