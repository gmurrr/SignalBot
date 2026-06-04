import { publicMarketDataColumns, type PublicMarketDataRow } from "@/lib/dashboard/public-data";
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
    const marketTable = getSafeTableName("SUPABASE_MARKET_DATA_TABLE", "market_data");
    const { data, error } = await supabase
      .from(marketTable)
      .select(publicMarketDataColumns)
      .eq("symbol", symbol)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return noStoreJson({ market: (data as PublicMarketDataRow | null) ?? null });
  } catch (error) {
    console.error("Dashboard market data load failed:", error);
    return noStoreJson({ error: "Unable to load market data." }, { status: 500 });
  }
}
