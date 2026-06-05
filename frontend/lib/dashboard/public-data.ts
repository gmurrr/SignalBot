import type { MarketDataRow, SignalRow } from "@/types/database";

export type PublicSignalRow = Pick<
  SignalRow,
  | "id"
  | "symbol"
  | "type"
  | "entry_price"
  | "tp"
  | "sl"
  | "status"
  | "timestamp"
  | "expires_at"
  | "closed_at"
  | "exit_price"
  | "result_pips"
  | "close_reason"
  | "confidence"
  | "timeframe"
  | "updated_at"
>;

export type PublicMarketDataRow = Pick<
  MarketDataRow,
  "id" | "symbol" | "tick_time" | "bid" | "ask" | "mid" | "source" | "timeframe" | "updated_at"
>;

export const publicSignalColumns =
  "id,symbol,type,entry_price,tp,sl,status,timestamp,expires_at,closed_at,exit_price,result_pips,close_reason,confidence,timeframe,updated_at";

export const publicMarketDataColumns = "id,symbol,tick_time,bid,ask,mid,source,timeframe,updated_at";
