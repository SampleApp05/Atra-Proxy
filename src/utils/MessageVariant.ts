export enum SearchMessageVariant {
  SEARCH_RESULT = "search:result",
  SEARCH_REQUEST = "search:request",
}

export enum CoinUpdateVariant {
  TOP_MARKETCAP = "top_marketcap",
  TOP_GAINERS = "top_gainers",
  TOP_LOSERS = "top_losers",
  TOP_VOLUME = "top_volume",
  COIN_CACHE = "coin_cache",
}
export enum SocketAction {
  AUTHENTICATION = "authentication",
  FETCH = "fetch",
}