import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import {v5 as uuidv5} from "uuid";
import { fetchTopCoins, Coin } from "./fetcher";
import { getWatchlist } from "./watchlistBuilder";
import { CoinUpdateVariant, SocketAction } from "./utils/MessageVariant";
import { APIConfig } from "./utils/APIConfig";
import {
  ErrorCode,
  buildSocketErrorResponse,
} from "./utils/ErrorResponseBuilder";
import { get } from "http";

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
    event: "status",
    data: {
      lastUpdated: getUpdateTime(),
      nextUpdate: getNextUpdateTime(),
      isLoading
    }
  });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error("❌ Failed to send status message to client:", error);
      }
    }
  });
}

function getWatchlistID(variant: CoinUpdateVariant): string {
  return uuidv5(variant, APIConfig.WATCHLIST_NAMESPACE);
}

function fetchWatchlistName(variant: CoinUpdateVariant): string {
  switch (variant) {
    case CoinUpdateVariant.TOP_MARKETCAP:
      return "Top Market Cap";
    case CoinUpdateVariant.TOP_GAINERS:
      return "Top Gainers";
    case CoinUpdateVariant.TOP_LOSERS:
      return "Top Losers";
    case CoinUpdateVariant.TOP_VOLUME:
      return "Most Traded";
  }
}

export function broadcastWatchlists(wss: WebSocketServer) {
  const variants = Object.values(CoinUpdateVariant);

  variants.forEach((variant) => {
    const list = getWatchlist(variant, coinCache);
    const message = JSON.stringify({
      event: "watchlist_update",
      data: {
        id: getWatchlistID(variant),
        name: fetchWatchlistName(variant),
        coins: list
      }
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error("❌ Failed to send watchlist message to client:", error);
        }
      }
    });
  });
}

export function broadcastCoins(wss: WebSocketServer) {
  const { data, lastUpdated, nextUpdate } = getCache();
  const message = JSON.stringify({
    event: "cache_update",
    data: {
      lastUpdated,
      nextUpdate,
      data
    }
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error("❌ Failed to send coins message to client:", error);
      }
    }
  });
}

export function sendInitialDataToClient(ws: WebSocket) {
  const { data, lastUpdated, nextUpdate } = getCache();

  try {
    console.log(`📊 Sending initial data to client. Cache has ${data?.length || 0} coins`);
    
    // Send status first
    ws.send(JSON.stringify({
      event: "status",
      data: {
        lastUpdated,
        nextUpdate,
        isLoading: false
      }
    }));
    console.log("✅ Status sent");

    // Send coins update after 1 second
    setTimeout(() => {
      ws.send(JSON.stringify({
        event: "cache_update",
        data: {
          lastUpdated,
          nextUpdate,
          data
        }
      }));
      console.log("✅ Coins update sent");

      // Send watchlists if we have coin data after another 1 second
      setTimeout(() => {
        if (data && data.length > 0) {
          console.log("📋 Sending watchlists...");
          const variants = Object.values(CoinUpdateVariant);
          
          // Send watchlists with 1 second delay between each
          variants.forEach((variant, index) => {
            setTimeout(() => {
              try {
                const list = getWatchlist(variant, coinCache);
                console.log(`📋 Sending watchlist for ${variant}: ${list.length} coins`);
                ws.send(JSON.stringify({
                  event: "watchlist_update",
                  data: {
                    id: getWatchlistID(variant),
                    name: fetchWatchlistName(variant),
                    coins: list
                  }
                }));
                console.log(`✅ Watchlist ${variant} sent`);
              } catch (watchlistError) {
                console.error(`❌ Failed to send watchlist ${variant}:`, watchlistError);
              }
            }, index * 1000); // 1 second delay between each watchlist
          });
        } else {
          console.log("⚠️ No coin data available, skipping watchlists");
        }
      }, 1000);
    }, 1000);
    
    console.log("✅ Initial data sending started with delays");
  } catch (error) {
    console.error("❌ Failed to send initial data to client:", error);
  }
}

export async function fetchCoinsData(wss: WebSocketServer) {
  try {
    broadcastStatus(wss, true); // isLoading = true

    const coins = await fetchTopCoins();

    if (coins.length === 0) throw new Error("Received empty coin list");
    persistCache(coins);

    broadcastStatus(wss, false); // isLoading = false
    broadcastCoins(wss);
    broadcastWatchlists(wss);
  } catch (error) {
    console.error("❌ Failed to fetch coin data:", error);

    const response = buildSocketErrorResponse(ErrorCode.FETCH_FAILED, SocketAction.FETCH);
    broadcastStatus(wss, false); // isLoading = false, but we have error

    // Send error response to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(response);
        } catch (error) {
          console.error("❌ Failed to send error message to client:", error);
        }
      }
    });
  }
}
