"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Clock3, Flag, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, formatRelativeTimestamp, formatSignedPips } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SignalRow } from "@/types/database";

const symbol = process.env.NEXT_PUBLIC_SIGNAL_SYMBOL ?? "XAUUSD";
const signalsTable = process.env.NEXT_PUBLIC_SUPABASE_SIGNALS_TABLE ?? "signals";

export function SignalDeck() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      const { data } = await supabase
        .from(signalsTable)
        .select("*")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(10);

      setSignals(((data as SignalRow[] | null) ?? []).sort(sortSignals));
    }

    bootstrap();

    const channel = supabase
      .channel("signals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: signalsTable, filter: `symbol=eq.${symbol}` },
        (payload) => {
          if (!payload.new) {
            return;
          }

          const nextSignal = payload.new as SignalRow;
          setSignals((current) => {
            const withoutCurrent = current.filter((item) => item.id !== nextSignal.id);
            return [nextSignal, ...withoutCurrent].sort(sortSignals).slice(0, 10);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const activeSignal = signals.find((signal) => signal.status === "ACTIVE") ?? null;
  const history = signals.filter((signal) => signal.id !== activeSignal?.id);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Current Signal</p>
            <h2 className="mt-2 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">Smart Signal Desk</h2>
          </div>
          <Badge>{activeSignal ? "Realtime armed" : "Awaiting setup"}</Badge>
        </div>
        <AnimatePresence mode="wait">
          {activeSignal ? (
            <motion.div
              key={activeSignal.id}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.98 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <SignalCard signal={activeSignal} now={now} featured />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="flex min-h-[320px] flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-[rgba(212,175,55,0.2)] p-3 text-brass">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-cormorant)] text-3xl">No open position</h3>
                    <p className="text-sm text-muted">The engine is waiting for fresh multi-timeframe alignment.</p>
                  </div>
                </div>
                <p className="max-w-xl text-sm leading-7 text-muted">
                  When a new XAU/USD opportunity appears, the card enters with a gold glow and the previous trade moves into history automatically.
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">History</p>
          <span className="text-xs uppercase tracking-[0.26em] text-muted">Latest transitions</span>
        </div>
        <div className="space-y-4">
          {history.map((signal, index) => (
            <motion.div key={signal.id} layout initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.38, delay: index * 0.04 }}>
              <SignalCard signal={signal} now={now} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  now,
  featured = false
}: {
  signal: SignalRow;
  now: number;
  featured?: boolean;
}) {
  const total = new Date(signal.expires_at).getTime() - new Date(signal.timestamp).getTime();
  const remaining = new Date(signal.expires_at).getTime() - now;
  const progress = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <Card
      className={cn(
        "transition-all duration-300",
        featured && signal.status === "ACTIVE" && "signal-glow border-brass/35",
        signal.status !== "ACTIVE" && "border-[rgba(255,255,255,0.06)] bg-[rgba(11,11,11,0.8)] opacity-80"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <Badge className={cn(signal.type === "Buy" ? "text-brass" : "text-[#f2d79f]")}>{signal.type}</Badge>
            <span className="text-xs uppercase tracking-[0.28em] text-muted">{signal.status}</span>
          </div>
          <h3 className="mt-4 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">
            {signal.status === "ACTIVE" ? "Execution Window Open" : "Position Closed"}
          </h3>
          <p className="mt-3 max-w-lg text-sm leading-7 text-muted">
            {signal.status === "ACTIVE"
              ? "The setup is still monitored in real time. TP, SL and expiry are guarded by the backend."
              : `Closed via ${signal.close_reason ?? "desk update"} with ${formatSignedPips(signal.result_pips)}.`}
          </p>
        </div>
        <div className="rounded-[24px] border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.05)] px-5 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Generated</p>
          <p className="mt-2 text-lg text-foreground">{formatRelativeTimestamp(signal.timestamp)}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.28em] text-muted">Confidence</p>
          <p className="mt-2 text-lg text-brass">{Math.round(signal.confidence * 100)}%</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Entry" value={formatPrice(signal.entry_price)} />
        <Metric label="Take Profit" value={formatPrice(signal.tp)} />
        <Metric label="Stop Loss" value={formatPrice(signal.sl)} />
        <Metric label={signal.status === "ACTIVE" ? "Live Result" : "Final Result"} value={formatSignedPips(signal.result_pips)} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-muted">
          <span className="inline-flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full bg-brass", signal.status === "ACTIVE" && "status-dot")} />
            {signal.status === "ACTIVE" ? "Live monitoring" : "Monitoring stopped"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5" />
            Expires {formatRelativeTimestamp(signal.expires_at)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8e6d1f,#D4AF37,#f6df8f)]"
            animate={{ width: `${signal.status === "ACTIVE" ? progress : 0}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {signal.status !== "ACTIVE" ? (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted">
          <Flag className="h-3.5 w-3.5" />
          {signal.status === "CLOSED" ? "Position closed" : "Signal expired"}
        </div>
      ) : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(212,175,55,0.1)] bg-[rgba(255,255,255,0.01)] p-4">
      <p className="text-xs uppercase tracking-[0.26em] text-muted">{label}</p>
      <p className="mt-3 text-xl text-foreground">{value}</p>
    </div>
  );
}

function sortSignals(a: SignalRow, b: SignalRow) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}
