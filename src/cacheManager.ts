import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import { fetchTopCoins, Coin } from "./fetcher";
import { getWatchlist } from "./watchlistBuilder";
import { CoinUpdateVariant, SocketAction } from "./utils/MessageVariant";
import { APIConfig } from "./utils/APIConfig";
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

export function getUpdateTime(): string | null {
  return lastUpdated;
}

export function getNextUpdateTime(): string {
  if (!lastUpdated) {
    // If no data, next update should be immediate
    return new Date().toISOString();
  }
  
  const lastUpdateMs = new Date(lastUpdated).getTime();
  const nextUpdateMs = lastUpdateMs + APIConfig.REFRESH_INTERVAL;
  return new Date(nextUpdateMs).toISOString();
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
  return { 
    data: coinCache, 
    lastUpdated: getUpdateTime(),
    nextUpdate: getNextUpdateTime()
  };
}

export function persistCache(data: Coin[]) {
  coinCache = data;
  lastUpdated = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, lastUpdated }, null, 2));
}

export function broadcastStatus(wss: WebSocketServer, isLoading: boolean = false) {
  const message = JSON.stringify({ 
    type: "status", 
    lastUpdated: getUpdateTime(),
    nextUpdate: getNextUpdateTime(),
    isLoading
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcastWatchlists(wss: WebSocketServer) {
  const variants = Object.values(CoinUpdateVariant);

  variants.forEach((variant) => {
    const list = getWatchlist(variant, coinCache);
    const message = JSON.stringify({
      type: "watchlist:update",
      variant,
      data: list,
      lastUpdated: getUpdateTime(),
      nextUpdate: getNextUpdateTime()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
}

export async function fetchCoinsData(wss: WebSocketServer) {
  try {
    broadcastStatus(wss, true); // isLoading = true

    const coins = await fetchTopCoins();

    if (coins.length === 0) throw new Error("Received empty coin list");
    persistCache(coins);

    broadcastStatus(wss, false); // isLoading = false
    broadcastWatchlists(wss);
  } catch (error) {
    console.error("❌ Failed to fetch coin data:", error);

    const response = buildSocketErrorResponse(ErrorCode.FETCH_FAILED, SocketAction.FETCH);
    broadcastStatus(wss, false); // isLoading = false, but we have error

    // Send error response to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(response);
      }
    });
  }
}
