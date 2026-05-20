import type { SupabaseClient } from "@supabase/supabase-js";

import { clearPasswordRecoverySession, getHashParams, getPasswordRecoveryLinkError, getSearchParams, markPasswordRecoverySession } from "@/lib/auth/recovery-session";
import type { Database } from "@/types/database";

export async function exchangePasswordRecoveryParams(supabase: SupabaseClient<Database>) {
  const linkError = getPasswordRecoveryLinkError();

  if (linkError) {
    clearPasswordRecoverySession();
    throw new Error(linkError.code ?? "password_recovery_link_error");
  }

  const hashParams = getHashParams();
  const searchParams = getSearchParams();
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const code = searchParams.get("code");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      throw error;
    }

    markPasswordRecoverySession();
    return data.session;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    markPasswordRecoverySession();
    return data.session;
  }

  return null;
}
