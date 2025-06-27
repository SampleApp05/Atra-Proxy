const { execSync } = require("child_process");
const fs = require("fs");

const sourceFile = "dependencies.json";

if (fs.existsSync(sourceFile) === false) {
  console.error(`❌ Missing dependency source file: ${sourceFile}`);
  process.exit(1);
}

const dependencyList = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));

const isValidDependency = (key) => {
  key === "common";
};

for (const [key, items] of Object.entries(dependencyList)) {
  if (isValidDependency(key) === false) {
    console.error(`❌ Invalid dependency key: ${key}`);
    continue;
  }

  if (Array.isArray(items) === false || items.length === 0) {
    console.log(`No ${key} dependencies found.`);
    continue;
  }

  console.log(`📦 Installing ${key} dependencies:\n`);

  for (const item of items) {
    try {
      console.log(`🧶 npm install ${item}`);
      execSync(`npm install ${item}`, { stdio: "inherit" });
    } catch (err) {
      console.error(`❌ Failed to install ${item} with error: ${err.message}`);
    }
  }

  console.log(`✅ Done installing ${key} dependencies\n`);
}
