import axios, { type AxiosInstance } from "axios";

export type AlpacaMode = "paper" | "live";

export type AlpacaCredentials = {
  apiKey: string;
  apiSecret: string;
  mode: AlpacaMode;
};

export type PlaceAlpacaOrderInput = {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  timeInForce: "day";
  limitPrice?: number;
};

function resolveBaseUrl(mode: AlpacaMode): string {
  return mode === "live" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets";
}

function createAlpacaClient(credentials: AlpacaCredentials): AxiosInstance {
  return axios.create({
    baseURL: resolveBaseUrl(credentials.mode),
    timeout: 30_000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "APCA-API-KEY-ID": credentials.apiKey,
      "APCA-API-SECRET-KEY": credentials.apiSecret,
    },
  });
}

export async function getAccount(credentials: AlpacaCredentials): Promise<Record<string, unknown>> {
  const client = createAlpacaClient(credentials);
  const { data } = await client.get("/v2/account");
  return data;
}

export async function getPositions(credentials: AlpacaCredentials): Promise<Record<string, unknown>[]> {
  const client = createAlpacaClient(credentials);
  const { data } = await client.get("/v2/positions");
  return Array.isArray(data) ? data : [];
}

export async function getOrders(
  credentials: AlpacaCredentials,
  status = "all",
): Promise<Record<string, unknown>[]> {
  const client = createAlpacaClient(credentials);
  const { data } = await client.get("/v2/orders", {
    params: { status, direction: "desc", limit: 100 },
  });
  return Array.isArray(data) ? data : [];
}

export async function placeOrder(
  credentials: AlpacaCredentials,
  input: PlaceAlpacaOrderInput,
): Promise<Record<string, unknown>> {
  const client = createAlpacaClient(credentials);
  const payload: Record<string, unknown> = {
    symbol: input.symbol.toUpperCase(),
    qty: String(input.qty),
    side: input.side,
    type: input.type,
    time_in_force: input.timeInForce,
  };
  if (input.type === "limit") {
    payload.limit_price = input.limitPrice;
  }
  const { data } = await client.post("/v2/orders", payload);
  return data;
}

export async function cancelOrder(credentials: AlpacaCredentials, orderId: string): Promise<boolean> {
  const client = createAlpacaClient(credentials);
  await client.delete(`/v2/orders/${encodeURIComponent(orderId)}`);
  return true;
}

export async function getPortfolioHistory(credentials: AlpacaCredentials): Promise<{
  equity: number[];
  timestamps: number[];
}> {
  const client = createAlpacaClient(credentials);
  const { data } = await client.get("/v2/account/portfolio/history", {
    params: { period: "1M", timeframe: "1D", extended_hours: false },
  });
  return {
    equity: Array.isArray(data?.equity) ? data.equity : [],
    timestamps: Array.isArray(data?.timestamp) ? data.timestamp : [],
  };
}

