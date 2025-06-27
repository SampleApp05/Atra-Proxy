// src/cacheManager.ts

import fs from "fs";
import WebSocket from "ws";
import path from "path";
import { fetchTopCoins, Coin } from "./fetcher";
import { getWatchlist } from "./watchlistBuilder";

const CACHE_FILE = "./cache/coinCache.json";

export enum DataStatus {
  OK = "ok",
  OUTDATED = "outdated",
  STALE = "stale",
  LOADING = "loading",
  MISSING = "missing",
  FAILED = "failed",
}

export enum UpdateVariant {
  TOP_MARKETCAP = "top_marketcap",
  TOP_GAINERS = "top_gainers",
  TOP_LOSERS = "top_losers",
  TOP_VOLUME = "top_volume",
}

let coinCache: Coin[] = [];
let lastUpdated: string | null = null;

export function getDataStatus(): DataStatus {
  if (lastUpdated == null) return DataStatus.MISSING;
  const updatedAt = new Date(lastUpdated).getTime();
  const now = Date.now();
  const diff = now - updatedAt;

  if (diff < 5 * 60 * 1000) return DataStatus.OK;
  if (diff < 15 * 60 * 1000) return DataStatus.OUTDATED;
  return DataStatus.STALE;
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

function persistCache(data: Coin[]) {
  coinCache = data;
  lastUpdated = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, lastUpdated }, null, 2));
}

export function broadcastStatus(wss: WebSocket.Server, status: DataStatus) {
  const message = JSON.stringify({ type: "status", status, lastUpdated });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastWatchlists(wss: WebSocket.Server) {
  const variants = Object.values(UpdateVariant);

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
    broadcastStatus(wss, DataStatus.LOADING); // or "loading"

    const coins = await fetchTopCoins();

    if (coins.length === 0) throw new Error("Received empty coin list");
    persistCache(coins);

    broadcastStatus(wss, DataStatus.OK);
    broadcastWatchlists(wss);
  } catch (error) {
    console.error("❌ Failed to fetch coin data:", error);

    const message = JSON.stringify({
      type: "error",
      message: "Failed to fetch data from CoinGecko",
      details: error instanceof Error ? error.message : String(error),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    broadcastStatus(wss, DataStatus.FAILED);
  }
}
