/**
 * LeekScript VSCode Extension Builder
 *
 * This script extracts data from the leek-wars submodule
 * and generates the necessary files for the extension.
 */

console.log("LeekScript Extension Builder");
console.log("============================\n");

// extract functions
const { extractFunctions } = require("./functions");
const { extractLang } = require("./lang");
const { extractConstants } = require("./constants");

extractFunctions();
extractLang();
extractConstants();
console.log("\nBuild completed successfully.");
