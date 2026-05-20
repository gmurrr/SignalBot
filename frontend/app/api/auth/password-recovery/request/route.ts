import { NextResponse, type NextRequest } from "next/server";

import { isValidEmail } from "@/lib/auth/password-policy";
import { normalizeEmail, recordAccountSecurityEvent } from "@/lib/auth/security-events";
import { getSupabaseAuthServerClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const redirectToUrl = new URL("/auth/callback", request.nextUrl.origin);
    redirectToUrl.searchParams.set("next", "/auth/reset-password");
    redirectToUrl.searchParams.set("type", "recovery");
    const redirectTo = redirectToUrl.toString();
    const supabase = getSupabaseAuthServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error && isRateLimitError(error.message)) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }

    if (error) {
      console.error("Password reset email request failed:", error.message);
    }

    await recordPasswordResetRequest({
      email,
      metadata: {
        redirect_to: redirectTo,
        user_agent: request.headers.get("user-agent")
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to request password reset." },
      { status: 500 }
    );
  }
}

async function recordPasswordResetRequest({ email, metadata }: { email: string; metadata: Record<string, string | null> }) {
  try {
    await recordAccountSecurityEvent({
      email,
      eventType: "password_reset_requested",
      metadata
    });
  } catch (error) {
    console.error("Password reset security event failed:", error);
  }
}

function isRateLimitError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("rate limit") || normalizedMessage.includes("security purposes");
}
