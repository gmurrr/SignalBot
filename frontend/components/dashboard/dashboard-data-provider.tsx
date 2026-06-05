"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchWithSupabaseSession } from "@/lib/auth/api";
import type { PublicMarketDataRow, PublicSignalRow } from "@/lib/dashboard/public-data";
import { dashboardRefreshMs } from "@/lib/dashboard/refresh";

type DashboardSnapshot = {
  market: PublicMarketDataRow | null;
  signals: PublicSignalRow[];
};

type DashboardDataContextValue = DashboardSnapshot & {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({ market: null, signals: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    try {
      const response = await fetchWithSupabaseSession("/api/dashboard/snapshot");
      if (!response.ok) {
        setError("Unable to load dashboard data.");
        return;
      }

      const payload = (await response.json()) as Partial<DashboardSnapshot>;
      setSnapshot({
        market: payload.market ?? null,
        signals: payload.signals ?? []
      });
      setError(null);
    } catch {
      setError("Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();

    const refreshTimer = window.setInterval(loadSnapshot, dashboardRefreshMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSnapshot();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadSnapshot]);

  const value = useMemo(
    () => ({
      ...snapshot,
      isLoading,
      error,
      refresh: loadSnapshot
    }),
    [error, isLoading, loadSnapshot, snapshot]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used inside DashboardDataProvider.");
  }

  return context;
}
