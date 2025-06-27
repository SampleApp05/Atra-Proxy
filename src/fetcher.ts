import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

const API_KEY = (process.env.COINGECKO_API_KEY as string) || ""; // set your key in env vars
const API_HOST = "https://api.coingecko.com";
const API_HEADER_KEY = "x-cg-demo-api-key"; // or "x-cg-pro-api-key" for prod

// delay helper
function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function fetchTopCoins(): Promise<Coin[]> {
  const perPage = 250;
  const totalPages = 4; // 4 * 250 = 1000 coins max
  const coinsMap = new Map<string, Coin>();

  for (let page = 1; page <= totalPages; page++) {
    const url = `${API_HOST}/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&price_change_percentage=24h`;

    console.log(`🌐 Fetching page ${page}: ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          [API_HEADER_KEY]: API_KEY,
        },
      });

      if (res.ok == false) {
        console.error(
          `❌ Page ${page} failed with status ${
            res.status
          }: ${await res.text()}`
        );
        break; // Stop fetching on failure
      }

      const data = (await res.json()) as Coin[];

      // Add unique coins by id
      data.forEach((coin) => {
        if (coinsMap.has(coin.id) == false) {
          coinsMap.set(coin.id, coin);
        }
      });

      // Delay between requests (e.g., 1 second)
      await delay(1000);
    } catch (e) {
      console.error(`❌ Error fetching page ${page}:`, e);
      break;
    }
  }

  console.log(`✅ Fetched ${coinsMap.size} unique coins total.`);
  return Array.from(coinsMap.values());
}
