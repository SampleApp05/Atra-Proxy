import dotenv from "dotenv";
dotenv.config();

export class APIConfig {
    static PORT = 8080;
    static COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "missing-coingecko-api-key";
    static COINGECKO_API_HOST = "https://api.coingecko.com";
    static COINGECKO_API_HEADER_KEY = "x-cg-demo-api-key"; //
    static AUTH_TOKEN = process.env.CLIENT_AUTH_TOKEN || "missing-auth-token";
    static REFRESH_INTERVAL = 300 * 60 * 1000; // 5 minutes

    private constructor() {}
}