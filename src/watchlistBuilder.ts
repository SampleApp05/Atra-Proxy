import { Coin } from "./fetcher";
import { UpdateVariant } from "./cacheManager"; // or own file

function getTopCoinsByCap(coins: Coin[]): Coin[] {
  return coins
    .slice()
    .sort((lhs, rhs) => rhs.market_cap - lhs.market_cap)
    .slice(0, 25);
}

function getTopCoinsByVolume(coins: Coin[]): Coin[] {
  return coins
    .slice()
    .sort((lhs, rhs) => rhs.total_volume - lhs.total_volume)
    .slice(0, 25);
}

function getTopCoinsByMove(coins: Coin[], positive: Boolean): Coin[] {
  return coins
    .slice()
    .sort((lhs, rhs) =>
      positive
        ? rhs.price_change_percentage_24h - lhs.price_change_percentage_24h
        : lhs.price_change_percentage_24h - rhs.price_change_percentage_24h
    )
    .slice(0, 25);
}

export function getWatchlist(variant: UpdateVariant, coins: Coin[]): Coin[] {
  switch (variant) {
    case UpdateVariant.TOP_MARKETCAP:
      return getTopCoinsByCap(coins);

    case UpdateVariant.TOP_GAINERS:
      return getTopCoinsByMove(coins, true);

    case UpdateVariant.TOP_LOSERS:
      return getTopCoinsByMove(coins, false);

    case UpdateVariant.TOP_VOLUME:
      return getTopCoinsByVolume(coins);

    default:
      return [];
  }
}
