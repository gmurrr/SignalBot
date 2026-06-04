import { publicSignalColumns, type PublicSignalRow } from "@/lib/dashboard/public-data";
import { getSafeSymbol, getSafeTableName, noStoreJson, requireDashboardAccess } from "@/lib/dashboard/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireDashboardAccess(request);
  if ("response" in access) {
    return access.response;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const symbol = getSafeSymbol();
    const signalsTable = getSafeTableName("SUPABASE_SIGNALS_TABLE", "signals");

    const { data, error } = await supabase
      .from(signalsTable)
      .select(publicSignalColumns)
      .eq("symbol", symbol)
      .order("timestamp", { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    return noStoreJson({ signals: (data ?? []) as PublicSignalRow[] });
  } catch (error) {
    console.error("Dashboard signals load failed:", error);
    return noStoreJson({ error: "Unable to load signals." }, { status: 500 });
  }
}
