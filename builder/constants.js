/**
 * Extract constants from leek-wars submodule
 */

const fs = require("fs");
const path = require("path");

/**
 * Extracts the CONSTANTS array from the leek-wars constants.ts file
 * and saves it as JSON
 */
function extractConstants() {
  console.log("Extracting constants...");

  // Path to the source file
  const constantsPath = path.join(
    __dirname,
    "../leek-wars/src/model/constants.ts"
  );

  // Read the TypeScript file
  const content = fs.readFileSync(constantsPath, "utf8");

  // Extract the CONSTANTS array using regex
  // Match: export const CONSTANTS: readonly Constant[] = Object.freeze([...])
  const match = content.match(
    /export const CONSTANTS[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)\s*$/m
  );

  if (!match) {
    throw new Error("Could not find CONSTANTS array in constants.ts");
  }

  let arrayContent = match[1].trim();

  // The file has two objects per line - wrap in brackets to make valid JS
  const jsCode = "[" + arrayContent + "]";
  const constants = eval(jsCode);

  // Create extracted directory if it doesn't exist
  const extractedDir = path.join(__dirname, "../extracted");
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir);
  }

  // Write to JSON file
  const outputPath = path.join(extractedDir, "constants.json");
  fs.writeFileSync(outputPath, JSON.stringify(constants, null, 2), "utf8");

  console.log(`✓ Extracted ${constants.length} constants to ${outputPath}`);

  return constants;
}

module.exports = { extractConstants };
