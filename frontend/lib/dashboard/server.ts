import "server-only";

import { NextResponse } from "next/server";

import { getAccountOverview } from "@/lib/account/server";
import { getUserFromRequest } from "@/lib/supabase/admin";

export async function requireDashboardAccess(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return {
      response: noStoreJson({ error: "Unauthorized" }, { status: 401 })
    } as const;
  }

  const overview = await getAccountOverview(user);
  if (!overview.hasAccess) {
    return {
      response: noStoreJson({ error: "Subscription required." }, { status: 403 })
    } as const;
  }

  return {
    overview,
    user
  } as const;
}

export function getSafeSymbol() {
  const candidate = process.env.SIGNAL_SYMBOL || process.env.NEXT_PUBLIC_SIGNAL_SYMBOL || "XAUUSD";
  const normalized = candidate.trim().toUpperCase();

  if (!/^[A-Z0-9._:-]{2,32}$/.test(normalized)) {
    return "XAUUSD";
  }

  return normalized;
}

export function getSafeTableName(envName: string, fallback: string) {
  const candidate = process.env[envName]?.trim() || fallback;

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(candidate)) {
    return fallback;
  }

  return candidate;
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
