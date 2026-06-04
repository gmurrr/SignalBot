import { NextResponse } from "next/server";

import { isValidEmail } from "@/lib/auth/password-policy";
import { normalizeEmail } from "@/lib/auth/security-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate email." },
      { status: 500 }
    );
  }
}
