export type SignalStatus = "ACTIVE" | "CLOSED" | "EXPIRED";
export type SignalType = "Buy" | "Sell";

export interface MarketDataRow {
  id: string;
  symbol: string;
  tick_time: string;
  bid: number;
  ask: number;
  mid: number;
  source: string;
  timeframe: string;
  updated_at: string;
}

export interface SignalRow {
  id: string;
  symbol: string;
  type: SignalType;
  entry_price: number;
  tp: number;
  sl: number;
  status: SignalStatus;
  timestamp: string;
  expires_at: string;
  closed_at: string | null;
  exit_price: number | null;
  result_pips: number | null;
  close_reason: string | null;
  confidence: number;
  timeframe: string;
  strategy_version: string;
  reason: string;
  indicator_snapshot: Record<string, number | string | null>;
  metadata: Record<string, number | string | null>;
}

export interface Database {
  public: {
    Tables: {
      market_data: {
        Row: MarketDataRow;
      };
      signals: {
        Row: SignalRow;
      };
    };
  };
}
