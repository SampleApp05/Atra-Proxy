import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

const key = (process.env.CLIENT_AUTH_TOKEN as string) || "random-key";
const ws = new WebSocket("ws://localhost:8080?token=" + key);

const requestId = "test-1234";

ws.on("open", () => {
  console.log("✅ Connected to server");

  const searchMessage = {
    type: "search:request",
    query: "btc",
    requestID: requestId,
    maxResults: 5,
  };

  ws.send(JSON.stringify(searchMessage));
  console.log("🔍 Sent search query:", searchMessage.query);
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.type === "search:result" && msg.requestID === requestId) {
      console.log("✅ Search Results:", msg.results);
    } else if (msg.type === "error") {
      console.error("❌ Server Error:", msg.message);
    } else {
      console.log("📩 Other Message:", msg);
    }
  } catch (err) {
    console.error("❌ Failed to parse message:", err);
  }
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err);
});

ws.on("close", () => {
  console.log("🔌 Disconnected from server");
});
