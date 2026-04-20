"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Clock3, Flag, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, formatRelativeTimestamp, formatSignedPips } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SignalRow, SignalStatus, SignalType } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

const symbol = process.env.NEXT_PUBLIC_SIGNAL_SYMBOL ?? "XAUUSD";
const signalsTable = process.env.NEXT_PUBLIC_SUPABASE_SIGNALS_TABLE ?? "signals";

export function SignalDeck() {
  const { dict, locale } = useI18n();
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
        .limit(5);

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
            return [nextSignal, ...withoutCurrent].sort(sortSignals).slice(0, 5);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const activeSignal = signals.find((signal) => signal.status === "ACTIVE") ?? null;
  const history = signals.filter((signal) => signal.id !== activeSignal?.id).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">{dict.signals.currentLabel}</p>
            <h2 className="mt-2 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">{dict.signals.terminalTitle}</h2>
          </div>
          <Badge>{activeSignal ? dict.signals.activeBadge : dict.signals.waitingBadge}</Badge>
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
              <SignalCard signal={activeSignal} now={now} labels={dict.signals} locale={locale} featured />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="flex min-h-[320px] flex-col justify-between border-[#1A1A1A]">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-[rgba(212,175,55,0.2)] p-3 text-brass">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-cormorant)] text-3xl">{dict.signals.emptyTitle}</h3>
                    <p className="text-sm text-muted">{dict.signals.emptyBody}</p>
                  </div>
                </div>
                <p className="max-w-xl text-sm leading-7 text-muted">{dict.signals.emptyDescription}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{dict.signals.historyTitle}</p>
          <span className="text-xs uppercase tracking-[0.26em] text-muted">{dict.signals.latestRecords}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {history.map((signal, index) => (
            <motion.div
              key={signal.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.38, delay: index * 0.04 }}
            >
              <SignalCard signal={signal} now={now} labels={dict.signals} locale={locale} compact />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalCard({
  signal,
  now,
  labels,
  locale,
  featured = false,
  compact = false
}: {
  signal: SignalRow;
  now: number;
  labels: Dictionary["signals"];
  locale: Locale;
  featured?: boolean;
  compact?: boolean;
}) {
  const total = new Date(signal.expires_at).getTime() - new Date(signal.timestamp).getTime();
  const remaining = new Date(signal.expires_at).getTime() - now;
  const progress = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const statusLabel = translateStatus(signal.status, labels);
  const isActive = signal.status === "ACTIVE";

  return (
    <Card
      className={cn(
        "h-full border-[#1A1A1A] transition-all duration-300",
        featured && isActive && "signal-glow border-brass/35",
        !isActive && "bg-[rgba(11,11,11,0.8)] opacity-80",
        compact && "p-5"
      )}
    >
      <div className={cn("flex flex-wrap items-start justify-between gap-6", compact && "gap-4")}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={cn(signal.type === "Buy" ? "text-brass" : "text-[#f2d79f]")}>{translateType(signal.type, labels)}</Badge>
            <span className="text-xs uppercase tracking-[0.28em] text-muted">{statusLabel}</span>
          </div>
          <h3 className={cn("mt-4 font-[family-name:var(--font-cormorant)] text-4xl text-foreground", compact && "text-2xl")}>
            {isActive ? labels.executionOpen : labels.positionClosed}
          </h3>
          {!compact ? (
            <p className="mt-3 max-w-lg text-sm leading-7 text-muted">
              {isActive
                ? labels.activeDescription
                : `${labels.closedDescriptionPrefix} ${translateCloseReason(signal.close_reason, labels)} ${labels.closedDescriptionSuffix} ${formatSignedPips(signal.result_pips)}.`}
            </p>
          ) : null}
        </div>
        {!compact ? (
          <div className="rounded-[24px] border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.05)] px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{labels.generated}</p>
            <p className="mt-2 text-lg text-foreground">{formatRelativeTimestamp(signal.timestamp, locale)}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.28em] text-muted">{labels.confidence}</p>
            <p className="mt-2 text-lg text-brass">{Math.round(signal.confidence * 100)}%</p>
          </div>
        ) : null}
      </div>

      <div className={cn("mt-8 grid gap-4 md:grid-cols-4", compact && "mt-5 grid-cols-1 md:grid-cols-1")}>
        <Metric label={labels.entry} value={formatPrice(signal.entry_price)} compact={compact} />
        <Metric label={labels.tp} value={formatPrice(signal.tp)} compact={compact} />
        <Metric label={labels.sl} value={formatPrice(signal.sl)} compact={compact} />
        <Metric label={isActive ? labels.liveResult : labels.finalResult} value={formatSignedPips(signal.result_pips)} compact={compact} />
      </div>

      <div className={cn("mt-8", compact && "mt-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-muted">
          <span className="inline-flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full bg-brass", isActive && "status-dot")} />
            {isActive ? labels.monitoringActive : labels.monitoringStopped}
          </span>
          {!compact ? (
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" />
              {labels.expires} {formatRelativeTimestamp(signal.expires_at, locale)}
            </span>
          ) : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8e6d1f,#D4AF37,#f6df8f)]"
            animate={{ width: `${isActive ? progress : 0}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {!isActive ? (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted">
          <Flag className="h-3.5 w-3.5" />
          {signal.status === "CLOSED" ? labels.positionClosed : labels.expired}
        </div>
      ) : null}
    </Card>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[22px] border border-[rgba(212,175,55,0.1)] bg-[rgba(255,255,255,0.01)] p-4", compact && "p-3")}>
      <p className="text-xs uppercase tracking-[0.26em] text-muted">{label}</p>
      <p className={cn("mt-3 text-xl text-foreground", compact && "text-base")}>{value}</p>
    </div>
  );
}

function translateStatus(status: SignalStatus, labels: Dictionary["signals"]) {
  return labels.status[status];
}

function translateType(type: SignalType, labels: Dictionary["signals"]) {
  return labels.type[type];
}

function translateCloseReason(reason: string | null | undefined, labels: Dictionary["signals"]) {
  if (!reason) {
    return labels.closeReasons.fallback;
  }

  const closeReasons = labels.closeReasons as Record<string, string>;

  return closeReasons[reason.toLowerCase()] ?? reason;
}

function sortSignals(a: SignalRow, b: SignalRow) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}
