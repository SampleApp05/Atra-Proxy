import dotenv from "dotenv";
dotenv.config();

const key = (process.env.CLIENT_AUTH_TOKEN as string) || "random-key";

const ws = new WebSocket("ws://localhost:8080?token=" + key);

ws.onopen = () => {
  console.log("✅ WebSocket connection opened");
};

ws.onmessage = (event) => {
  console.log("📩 Received:", JSON.parse(event.data));
};

ws.onerror = (err) => {
  console.error("❌ WebSocket error:", err);
};

ws.onclose = () => {
  console.log("🔌 Connection closed");
};
