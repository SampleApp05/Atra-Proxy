const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "../coinCache.json");

fs.readFile(filePath, "utf-8", (err, data) => {
  if (err) {
    console.error("❌ Error reading coinCache.json:", err.message);
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(data);
    const count = Array.isArray(parsed.data) ? parsed.data.length : 0;
    console.log(`✅ Coin cache contains ${count} coin objects.`);
  } catch (e) {
    console.error("❌ Error parsing JSON:", e.message);
    process.exit(1);
  }
});
