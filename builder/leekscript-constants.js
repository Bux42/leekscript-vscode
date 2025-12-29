/**
 * Extract LeekScript error constants from leek-wars submodule
 */

const fs = require("fs");
const path = require("path");

/**
 * Extracts the LeekScript error messages from the leek-wars leekscript.json language file
 * and saves it as JSON
 */
function extractLeekScriptConstants() {
  console.log("Extracting LeekScript constants...");

  // Path to the source file
  const leekscriptLangPath = path.join(
    __dirname,
    "../leek-wars/src/lang/en/leekscript.json"
  );

  // Check if file exists
  if (!fs.existsSync(leekscriptLangPath)) {
    throw new Error(`LeekScript language file not found at ${leekscriptLangPath}`);
  }

  // Read the JSON file
  const content = fs.readFileSync(leekscriptLangPath, "utf8");
  const leekscriptConstants = JSON.parse(content);

  // Create extracted directory if it doesn't exist
  const extractedDir = path.join(__dirname, "../extracted");
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir);
  }

  // Write to JSON file
  const outputPath = path.join(extractedDir, "leekscript_constants.json");
  fs.writeFileSync(outputPath, JSON.stringify(leekscriptConstants, null, 2), "utf8");

  const errorCount = Object.keys(leekscriptConstants).filter(key => key.startsWith("error_")).length;
  console.log(`✓ Extracted ${errorCount} error messages to ${outputPath}`);

  return leekscriptConstants;
}

module.exports = { extractLeekScriptConstants };
