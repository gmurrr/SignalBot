import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("user_email_exists", {
      check_email: email
    });

    if (!error) {
      return NextResponse.json({ exists: Boolean(data) });
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("user_accounts")
      .select("id")
      .ilike("email", escapeLikePattern(email))
      .limit(1);

    if (fallbackError) {
      throw fallbackError;
    }

    return NextResponse.json({ exists: Boolean(fallbackRows?.length) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify email availability." },
      { status: 500 }
    );
  }
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
