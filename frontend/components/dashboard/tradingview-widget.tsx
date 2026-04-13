"use client";

import { useEffect, useId, useRef } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TradingViewWidget() {
  const containerId = useId().replace(/:/g, "");
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) {
      return;
    }

    mountedRef.current = true;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "TVC:GOLD",
      interval: "15",
      timezone: "Europe/Warsaw",
      theme: "dark",
      style: "1",
      locale: "pl",
      withdateranges: true,
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      details: false,
      support_host: "https://www.tradingview.com"
    });

    document.getElementById(containerId)?.appendChild(script);
  }, [containerId]);

  return (
    <Card className="h-[560px] overflow-hidden border-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-cormorant)] text-3xl">Struktura rynku XAU/USD</CardTitle>
      </CardHeader>
      <CardContent className="h-[470px]">
        <div className="tradingview-widget-container h-full">
          <div id={containerId} className="h-full" />
        </div>
      </CardContent>
    </Card>
  );
}
