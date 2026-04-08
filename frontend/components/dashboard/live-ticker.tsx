"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, formatRelativeTimestamp } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MarketDataRow } from "@/types/database";

const symbol = process.env.NEXT_PUBLIC_SIGNAL_SYMBOL ?? "XAUUSD";
const marketTable = process.env.NEXT_PUBLIC_SUPABASE_MARKET_DATA_TABLE ?? "market_data";

export function LiveTicker() {
  const [market, setMarket] = useState<MarketDataRow | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      const { data } = await supabase.from(marketTable).select("*").eq("symbol", symbol).maybeSingle();
      if (data) {
        setMarket(data as MarketDataRow);
      }
    }

    bootstrap();

    const channel = supabase
      .channel("market-data-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: marketTable, filter: `symbol=eq.${symbol}` },
        (payload) => {
          if (payload.new) {
            setMarket(payload.new as MarketDataRow);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="gold-glow relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.15),transparent_55%),rgba(8,8,8,0.92)]">
      <div className="flex items-center justify-between gap-3">
        <Badge className="gap-2">
          <span className="status-dot h-2.5 w-2.5 rounded-full bg-brass" />
          LIVE SPOT
        </Badge>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted">
          <Radio className="h-3.5 w-3.5 text-brass" />
          {symbol}
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <div className="flex items-end gap-4">
          <span className="font-[family-name:var(--font-cormorant)] text-6xl leading-none tracking-tight text-foreground md:text-7xl">
            {formatPrice(market?.mid)}
          </span>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.18)] px-3 py-1 text-xs uppercase tracking-[0.24em] text-brass">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Gold Spot
          </span>
        </div>
        <div className="grid gap-3 text-sm text-muted md:grid-cols-3">
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">Bid</p>
            <p className="mt-1 text-lg text-foreground">{formatPrice(market?.bid)}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">Ask</p>
            <p className="mt-1 text-lg text-foreground">{formatPrice(market?.ask)}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">Updated</p>
            <p className="mt-1 text-lg text-foreground">{formatRelativeTimestamp(market?.updated_at)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
