#!/usr/bin/env ts-node
/**
 * Extract all function definitions from both LeekFunctions.java and FightFunctions.java
 *
 * This combines:
 * - Core LeekScript functions (arrays, strings, math, etc.)
 * - Fight-specific functions (entity, weapons, chips, etc.)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

console.log("Extracting all LeekScript functions...\n");

// First extract Fight functions
console.log("1. Extracting Fight functions from FightFunctions.java...");
execSync("npx ts-node builder/extract-fight-functions.ts", {
  stdio: "inherit",
});

// Now we need to extract from LeekFunctions.java using the same logic
console.log("\n2. Extracting core functions from LeekFunctions.java...");

const leekFunctionsPath = path.join(
  __dirname,
  "..",
  "leekscript-local",
  "src",
  "main",
  "java",
  "leekscript",
  "runner",
  "LeekFunctions.java"
);
const outputPath = path.join(
  __dirname,
  "..",
  "extracted",
  "core-functions.json"
);

// We can reuse the extract-fight-functions logic by copying the functions
// For now, let's just run a modified version
const extractScript = path.join(__dirname, "extract-fight-functions.ts");
const content = fs.readFileSync(extractScript, "utf-8");

// Modify to point to LeekFunctions.java
const modifiedContent = content
  .replace(
    "const javaFilePath = path.join(dataDir, 'FightFunctions.java');",
    "const javaFilePath = path.join(__dirname, '..', 'leekscript-local', 'src', 'main', 'java', 'leekscript', 'runner', 'LeekFunctions.java');"
  )
  .replace(
    "const outputPath = path.join(extractedDir, 'fight-functions.json');",
    "const outputPath = path.join(extractedDir, 'core-functions.json');"
  );

// Write temporary script
const tempScript = path.join(__dirname, "extract-core-functions-temp.ts");
fs.writeFileSync(tempScript, modifiedContent);

try {
  execSync(`npx ts-node "${tempScript}"`, { stdio: "inherit" });
} finally {
  // Clean up temp file
  if (fs.existsSync(tempScript)) {
    fs.unlinkSync(tempScript);
  }
}

// Now merge both files into one comprehensive list
console.log("\n3. Merging function definitions...");

const fightFunctions = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "extracted", "fight-functions.json"),
    "utf-8"
  )
);
const coreFunctions = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "extracted", "core-functions.json"),
    "utf-8"
  )
);

const merged = {
  version: fightFunctions.version,
  extractedAt: new Date().toISOString(),
  coreFunctions: coreFunctions.functions,
  fightFunctions: fightFunctions.functions,
  allFunctions: {
    ...coreFunctions.functions,
    ...fightFunctions.functions,
  },
};

const mergedPath = path.join(
  __dirname,
  "..",
  "extracted",
  "all-functions.json"
);
fs.writeFileSync(mergedPath, JSON.stringify(merged, null, 2));

console.log(
  `\nMerged ${Object.keys(coreFunctions.functions).length} core functions + ${
    Object.keys(fightFunctions.functions).length
  } fight functions`
);
console.log(`Total: ${Object.keys(merged.allFunctions).length} functions`);
console.log(`Written to: ${mergedPath}`);
