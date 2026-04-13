"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MarketStatusBadge({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(() => isGoldMarketOpen());

  useEffect(() => {
    const timer = window.setInterval(() => setIsOpen(isGoldMarketOpen()), 60_000);
    setIsOpen(isGoldMarketOpen());
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Badge className={cn("gap-2 border-[#1A1A1A] bg-[rgba(255,255,255,0.03)]", className)}>
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          isOpen ? "status-dot bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" : "bg-zinc-500"
        )}
      />
      {isOpen ? "RYNEK OTWARTY" : "RYNEK ZAMKNIĘTY"}
    </Badge>
  );
}

function isGoldMarketOpen() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;

  if (weekday === "Sat") {
    return false;
  }
  if (weekday === "Sun") {
    return minutes >= 23 * 60;
  }
  if (weekday === "Fri") {
    return minutes < 23 * 60;
  }
  return true;
}
