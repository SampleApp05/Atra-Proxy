import { Coin } from "./fetcher";

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
