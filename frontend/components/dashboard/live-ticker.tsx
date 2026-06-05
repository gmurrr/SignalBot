"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { formatPrice, formatRelativeTimestamp } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

const preferredSymbol = process.env.NEXT_PUBLIC_SIGNAL_SYMBOL ?? "XAUUSD";

export function LiveTicker() {
  const { dict, locale } = useI18n();
  const { market } = useDashboardData();
  const [flash, setFlash] = useState(false);
  const lastMidRef = useRef<number | null>(null);

  useEffect(() => {
    if (!market) {
      return;
    }

    if (lastMidRef.current !== null && market.mid !== lastMidRef.current) {
      setFlash(true);
      const flashTimer = window.setTimeout(() => setFlash(false), 420);
      lastMidRef.current = market.mid;
      return () => window.clearTimeout(flashTimer);
    }
    lastMidRef.current = market.mid;
  }, [market]);

  return (
    <Card className="gold-glow relative overflow-hidden border-[#1A1A1A] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.15),transparent_55%),rgba(8,8,8,0.92)]">
      <div className="flex items-center justify-between gap-3">
        <Badge className="gap-2">
          <span className="status-dot h-2.5 w-2.5 rounded-full bg-brass" />
          {dict.ticker.livePrice}
        </Badge>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted">
          <Radio className="h-3.5 w-3.5 text-brass" />
          {market?.symbol ?? preferredSymbol}
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <div className="flex items-end gap-4">
          <motion.span
            animate={{
              color: flash ? "#D4AF37" : "#f6f1e1",
              textShadow: flash ? "0 0 34px rgba(212,175,55,0.42)" : "0 0 0 rgba(212,175,55,0)"
            }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            className="font-[family-name:var(--font-cormorant)] text-6xl leading-none tracking-tight md:text-7xl"
          >
            {formatPrice(market?.mid)}
          </motion.span>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.18)] px-3 py-1 text-xs uppercase tracking-[0.24em] text-brass">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {dict.ticker.goldSpot}
          </span>
        </div>
        <div className="grid gap-3 text-sm text-muted md:grid-cols-3">
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">{dict.ticker.bid}</p>
            <p className="mt-1 text-lg text-foreground">{formatPrice(market?.bid)}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">{dict.ticker.ask}</p>
            <p className="mt-1 text-lg text-foreground">{formatPrice(market?.ask)}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.28em] text-[11px]">{dict.ticker.updated}</p>
            <p className="mt-1 text-lg text-foreground">{formatRelativeTimestamp(market?.updated_at, locale)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
