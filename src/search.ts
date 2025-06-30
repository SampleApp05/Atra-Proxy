import { Coin } from "./fetcher";
import { ErrorCode } from "./utils/ErrorResponnseBuilder";

export function searchCoins(query: string, coins: Coin[], maxResults = 25) {
  const searchQuery = query.toLowerCase();
  return coins
    .filter(
      (item) =>
        item.id.toLowerCase().includes(searchQuery) ||
        item.name.toLowerCase().includes(searchQuery) ||
        item.symbol.toLowerCase().includes(searchQuery)
    )
    .slice(0, maxResults);
}

/**
 * Performs a fallback search query using CoinGecko's public search API.
 * @param query The search term provided by the user.
 * @returns Array of matching coins from CoinGecko, or null on error.
 */
export async function fetchFromCoinGeckoAPI(query: string): Promise<any[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
      query
    )}`,
    {
      headers: {
        "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "",
      },
    }
  );

  if (res.ok != true) {
    console.error(`❌ CoinGecko API error ${res.status}: ${await res.text()}`);

    throw ErrorCode.SEARCH_FAILED;
  }

  const json = await res.json();
  return json.coins || [];
}
