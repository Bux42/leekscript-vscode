/**
 * Extract functions from leek-wars submodule
 */

const fs = require("fs");
const path = require("path");

/**
 * Extracts the FUNCTIONS array from the leek-wars functions.ts file
 * and saves it as JSON
 */
function extractFunctions() {
  console.log("Extracting functions...");

  // Path to the source file
  const functionsPath = path.join(
    __dirname,
    "../leek-wars/src/model/functions.ts"
  );

  // Read the TypeScript file
  const content = fs.readFileSync(functionsPath, "utf8");

  // Extract the FUNCTIONS array using regex
  // Match: export const FUNCTIONS: readonly LSFunction[] = Object.freeze([...])
  const match = content.match(
    /export const FUNCTIONS[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)\s*$/m
  );

  if (!match) {
    throw new Error("Could not find FUNCTIONS array in functions.ts");
  }

  let arrayContent = match[1].trim();

  // The file has two objects per line - wrap in brackets to make valid JS
  const jsCode = "[" + arrayContent + "]";
  const functions = eval(jsCode);

  // Create extracted directory if it doesn't exist
  const extractedDir = path.join(__dirname, "../extracted");
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir);
  }

  // Write to JSON file
  const outputPath = path.join(extractedDir, "functions.json");
  fs.writeFileSync(outputPath, JSON.stringify(functions, null, 2), "utf8");

  console.log(`✓ Extracted ${functions.length} functions to ${outputPath}`);

  return functions;
}

module.exports = { extractFunctions };
