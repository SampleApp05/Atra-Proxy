import fs from "fs";
import WebSocket from "ws";
import { fetchTopCoins, Coin } from "./fetcher";
import { getWatchlist } from "./watchlistBuilder";
import { DataState } from "./utils/DataState";
import { CoinUpdateVariant, SocketAction } from "./utils/MessageVariant";
import {
  ErrorCode,
  buildSocketErrorResponse,
} from "./utils/ErrorResponseBuilder";

const CACHE_FILE = "./cache/coinCache.json";

let coinCache: Coin[] = [];
let lastUpdated: string | null = null;

export function getCoinCache(): Coin[] {
  return coinCache;
}

export function getDataState(): DataState {
  if (lastUpdated == null) return DataState.MISSING;
  const updatedAt = new Date(lastUpdated).getTime();
  const now = Date.now();
  const diff = now - updatedAt;

  if (diff < 5 * 60 * 1000) return DataState.OK;
  if (diff < 15 * 60 * 1000) return DataState.OUTDATED;
  return DataState.STALE;
}

export function loadCache(): void {
  if (fs.existsSync(CACHE_FILE) == false) {
    console.log("📭 No cache file found.");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  coinCache = raw.data || [];
  lastUpdated = raw.lastUpdated || null;
  console.log(`🗃️ Cache loaded. Last updated: ${lastUpdated}`);
}

export function getCache() {
  return { data: coinCache, lastUpdated };
}

export function persistCache(data: Coin[]) {
  coinCache = data;
  lastUpdated = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, lastUpdated }, null, 2));
}

export function broadcastStatus(wss: WebSocket.Server, state: DataState) {
  const message = JSON.stringify({ type: "status", state, lastUpdated });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastWatchlists(wss: WebSocket.Server) {
  const variants = Object.values(CoinUpdateVariant);

  variants.forEach((variant) => {
    const list = getWatchlist(variant, coinCache);
    const message = JSON.stringify({
      type: "watchlist:update",
      variant,
      data: list,
      lastUpdated,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
}

export async function fetchCoinsData(wss: WebSocket.Server) {
  try {
    broadcastStatus(wss, DataState.LOADING); // or "loading"

    const coins = await fetchTopCoins();

    if (coins.length === 0) throw new Error("Received empty coin list");
    persistCache(coins);

    broadcastStatus(wss, DataState.OK);
    broadcastWatchlists(wss);
  } catch (error) {
    console.error("❌ Failed to fetch coin data:", error);

    const response = buildSocketErrorResponse(ErrorCode.FETCH_FAILED, SocketAction.FETCH);
    let dataState = getDataState();
    broadcastStatus(wss, dataState);

    // Send error response to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(response);
      }
    });
  }
}
