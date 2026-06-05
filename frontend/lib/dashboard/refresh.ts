const minRefreshMs = 5_000;
const maxRefreshMs = 120_000;

export const dashboardRefreshMs = readRefreshMs(
  process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS || process.env.NEXT_PUBLIC_MARKET_REFRESH_MS,
  15_000
);

function readRefreshMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minRefreshMs, Math.min(maxRefreshMs, parsed));
}
