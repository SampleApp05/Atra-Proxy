export enum SearchMessageVariant {
  SEARCH_RESULT = "search_result",
  SEARCH_REQUEST = "search_request",
}

export enum CoinUpdateVariant {
  TOP_MARKETCAP = "top_marketcap",
  TOP_GAINERS = "top_gainers",
  TOP_LOSERS = "top_losers",
  TOP_VOLUME = "top_volume"
}

export enum SocketAction {
  AUTHENTICATION = "authentication",
  FETCH = "fetch",
}