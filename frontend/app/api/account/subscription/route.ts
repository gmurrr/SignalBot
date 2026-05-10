import { NextResponse } from "next/server";

import { getAccountOverview } from "@/lib/account/server";
import { getUserFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overview = await getAccountOverview(user);
    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load account subscription." },
      { status: 500 }
    );
  }
}
