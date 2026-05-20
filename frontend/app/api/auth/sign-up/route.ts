import { NextResponse } from "next/server";

import { isStrongPassword, isValidEmail } from "@/lib/auth/password-policy";
import { recordRegistrationConsents } from "@/lib/legal/consent-audit";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/constants";
import { getRequestAuditMetadata } from "@/lib/legal/request";
import { getSupabaseAuthServerClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const acceptedLegal = body.acceptedLegal === true;
    const language = body.language === "EN" ? "EN" : "PL";

    if (!acceptedLegal) {
      return NextResponse.json({ error: "Legal acceptance is required." }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid e-mail is required." }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json({ error: "Password does not meet security requirements." }, { status: 400 });
    }

    const acceptedAt = new Date().toISOString();
    const supabase = getSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      options: {
        data: {
          legal_acceptance: {
            accepted_at: acceptedAt,
            privacy_accepted: true,
            privacy_accepted_at: acceptedAt,
            privacy_language: language,
            privacy_policy_language: language,
            privacy_policy_version: PRIVACY_VERSION,
            privacy_version: PRIVACY_VERSION,
            source: "REGISTER",
            terms_accepted: true,
            terms_accepted_at: acceptedAt,
            terms_language: language,
            terms_version: TERMS_VERSION
          }
        }
      },
      password
    });

    if (error) {
      throw error;
    }

    const auditMetadata = getRequestAuditMetadata(request);
    await recordRegistrationConsents({
      acceptedAt,
      email,
      ipAddress: auditMetadata.ipAddress,
      language,
      userAgent: auditMetadata.userAgent,
      userId: data.user?.id ?? null
    });

    return NextResponse.json({
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          }
        : null,
      user: data.user
        ? {
            email: data.user.email,
            id: data.user.id
          }
        : null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
