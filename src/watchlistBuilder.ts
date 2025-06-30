import { Coin } from "./fetcher";
import { CoinUpdateVariant } from "./utils/MessageVariant";

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

export function getWatchlist(
  variant: CoinUpdateVariant,
  coins: Coin[]
): Coin[] {
  switch (variant) {
    case CoinUpdateVariant.TOP_MARKETCAP:
      return getTopCoinsByCap(coins);

    case CoinUpdateVariant.TOP_GAINERS:
      return getTopCoinsByMove(coins, true);

    case CoinUpdateVariant.TOP_LOSERS:
      return getTopCoinsByMove(coins, false);

    case CoinUpdateVariant.TOP_VOLUME:
      return getTopCoinsByVolume(coins);

    default:
      return [];
  }
}
