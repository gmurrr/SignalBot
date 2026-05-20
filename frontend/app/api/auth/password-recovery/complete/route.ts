import { NextResponse } from "next/server";

import { findAccountById, normalizeEmail, recordAccountSecurityEvent } from "@/lib/auth/security-events";
import { getUserFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await findAccountById(user.id).catch((error) => {
    console.error("Password update account lookup failed:", error);
    return null;
  });
  const email = normalizeEmail(user.email ?? account?.email ?? "");

  if (!email) {
    return NextResponse.json({ error: "Missing user email." }, { status: 400 });
  }

  try {
    await recordAccountSecurityEvent({
      email,
      eventType: "password_updated",
      metadata: {
        source: "password_recovery"
      },
      userId: user.id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password update security event failed:", error);
    return NextResponse.json({ ok: true, eventRecorded: false });
  }
}
