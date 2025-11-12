/**
 * Extract language documentation from leek-wars submodule
 */

const fs = require("fs");
const path = require("path");

/**
 * Extracts the documentation from the leek-wars doc.en.lang file
 * and saves it as JSON
 */
function extractLang() {
  console.log("Extracting language documentation...");

  // Path to the source file
  const langPath = path.join(__dirname, "../leek-wars/src/lang/doc.en.lang");

  // Read the lang file
  const content = fs.readFileSync(langPath, "utf8");

  // Parse the JSON content
  const langData = JSON.parse(content);

  // Create extracted directory if it doesn't exist
  const extractedDir = path.join(__dirname, "../extracted");
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir);
  }

  // Write to JSON file
  const outputPath = path.join(extractedDir, "doc.en.json");
  fs.writeFileSync(outputPath, JSON.stringify(langData, null, 2), "utf8");

  const entryCount = Object.keys(langData).length;
  console.log(
    `✓ Extracted ${entryCount} documentation entries to ${outputPath}`
  );

  return langData;
}

module.exports = { extractLang };
