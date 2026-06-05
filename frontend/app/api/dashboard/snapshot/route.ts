import { publicMarketDataColumns, publicSignalColumns, type PublicMarketDataRow, type PublicSignalRow } from "@/lib/dashboard/public-data";
import { getSafeSymbols, getSafeTableName, noStoreJson, requireDashboardAccess } from "@/lib/dashboard/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

export async function GET(request: Request) {
  const access = await requireDashboardAccess(request);
  if ("response" in access) {
    return access.response;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const symbols = getSafeSymbols();
    const marketTable = getSafeTableName("SUPABASE_MARKET_DATA_TABLE", "market_data");
    const signalsTable = getSafeTableName("SUPABASE_SIGNALS_TABLE", "signals");

    const [market, signals] = await Promise.all([
      loadMarketData(supabase, marketTable, symbols),
      loadSignals(supabase, signalsTable, symbols)
    ]);

    return noStoreJson({ market, signals });
  } catch (error) {
    console.error("Dashboard snapshot load failed:", error);
    return noStoreJson({ error: "Unable to load dashboard data." }, { status: 500 });
  }
}

async function loadMarketData(supabase: SupabaseAdminClient, marketTable: string, symbols: string[]) {
  let { data, error } = await supabase
    .from(marketTable)
    .select(publicMarketDataColumns)
    .in("symbol", symbols)
    .eq("source", "mt5")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data && !error) {
    const fallback = await supabase
      .from(marketTable)
      .select(publicMarketDataColumns)
      .in("symbol", symbols)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data as PublicMarketDataRow | null) ?? null;
}

async function loadSignals(supabase: SupabaseAdminClient, signalsTable: string, symbols: string[]) {
  const { data, error } = await supabase
    .from(signalsTable)
    .select(publicSignalColumns)
    .in("symbol", symbols)
    .order("timestamp", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []) as PublicSignalRow[];
}
