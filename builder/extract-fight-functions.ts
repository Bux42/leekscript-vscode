#!/usr/bin/env ts-node
/**
 * Extract function definitions from FightFunctions.java
 *
 * This script parses the Java file and extracts:
 * - Function name
 * - Category (Entity, Weapon, Chip, Field, Fight, Network, Util)
 * - Operations cost
 * - Whether it's static
 * - Return type and parameter types for each version
 */

import * as fs from "fs";
import * as path from "path";

interface CallableVersion {
  returnType: string;
  parameters: string[];
}

interface FunctionDefinition {
  name: string;
  category: string;
  operations: number;
  isStatic: boolean;
  versions: CallableVersion[];
  minVersion?: number;
  maxVersion?: number;
}

interface ExtractedFunctions {
  version: string;
  extractedAt: string;
  functions: { [name: string]: FunctionDefinition };
}

/**
 * Parse a Type expression from Java (e.g., "Type.INT", "Type.ARRAY_INT_OR_NULL")
 */
function parseType(typeStr: string): string {
  // Remove "Type." prefix
  typeStr = typeStr.replace(/^Type\./, "");

  // Handle compound types
  if (typeStr.startsWith("compound(")) {
    // Extract types from compound
    const inner = typeStr.substring(9, typeStr.length - 1);
    const types = inner.split(",").map((t) => parseType(t.trim()));
    return types.join("|");
  }

  // Handle array types
  if (typeStr.startsWith("array(")) {
    const inner = typeStr.substring(6, typeStr.length - 1);
    return `array<${parseType(inner)}>`;
  }

  // Handle set types
  if (typeStr.startsWith("set(")) {
    const inner = typeStr.substring(4, typeStr.length - 1);
    return `set<${parseType(inner)}>`;
  }

  // Handle map types
  if (typeStr.startsWith("map(")) {
    const inner = typeStr.substring(4, typeStr.length - 1);
    const parts = inner.split(",").map((t) => t.trim());
    return `map<${parseType(parts[0])}, ${parseType(parts[1])}>`;
  }

  // Convert Java type names to simpler format
  const typeMap: { [key: string]: string } = {
    INT: "int",
    REAL: "real",
    STRING: "string",
    BOOL: "bool",
    ARRAY: "array",
    MAP: "map",
    SET: "set",
    NULL: "null",
    VOID: "void",
    ANY: "any",
    FUNCTION: "function",
    CLASS: "class",
    OBJECT: "object",
    INT_OR_NULL: "int?",
    INT_OR_REAL: "int|real",
    STRING_OR_NULL: "string?",
    BOOL_OR_NULL: "bool?",
    ARRAY_INT: "array<int>",
    ARRAY_INT_OR_NULL: "array<int>?",
    ARRAY_OR_NULL: "array?",
    MAP_STRING_STRING: "map<string,string>",
  };

  return typeMap[typeStr] || typeStr.toLowerCase();
}

/**
 * Extract function definition from a method() call line
 */
function parseMethodCall(
  lines: string[],
  startIdx: number
): { func: FunctionDefinition | null; endIdx: number } {
  let fullCall = "";
  let idx = startIdx;
  let braceCount = 0;
  let parenCount = 0;

  // Collect the full method call (may span multiple lines)
  while (idx < lines.length) {
    const line = lines[idx].trim();
    fullCall += " " + line;

    // Count braces and parentheses
    for (const char of line) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
    }

    // End when we find the closing semicolon and all braces/parens are balanced
    if (line.includes(");") && braceCount === 0 && parenCount === 0) {
      break;
    }

    idx++;
  }

  // Parse the method call using regex
  // Pattern: method("name", "category", operations, isStatic, ...)
  const methodMatch = fullCall.match(
    /method\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(true|false)/
  );

  if (!methodMatch) {
    // Try simpler pattern without operations: method("name", "category", isStatic, ...)
    const simpleMatch = fullCall.match(
      /method\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*(true|false)/
    );
    if (!simpleMatch) {
      return { func: null, endIdx: idx };
    }

    const [, name, category, isStaticStr] = simpleMatch;
    const isStatic = isStaticStr === "true";

    // Extract versions
    const versions = parseVersions(fullCall);

    return {
      func: {
        name,
        category,
        operations: 0,
        isStatic,
        versions,
      },
      endIdx: idx,
    };
  }

  const [, name, category, operationsStr, isStaticStr] = methodMatch;
  const operations = parseInt(operationsStr, 10);
  const isStatic = isStaticStr === "true";

  // Extract versions
  const versions = parseVersions(fullCall);

  // Extract min/max version if present
  let minVersion: number | undefined;
  let maxVersion: number | undefined;

  const minVerMatch = fullCall.match(/\.setMinVersion\s*\(\s*(\d+)\s*\)/);
  if (minVerMatch) {
    minVersion = parseInt(minVerMatch[1], 10);
  }

  const maxVerMatch = fullCall.match(/\.setMaxVersion\s*\(\s*(\d+)\s*\)/);
  if (maxVerMatch) {
    maxVersion = parseInt(maxVerMatch[1], 10);
  }

  const func: FunctionDefinition = {
    name,
    category,
    operations,
    isStatic,
    versions,
  };

  if (minVersion !== undefined) func.minVersion = minVersion;
  if (maxVersion !== undefined) func.maxVersion = maxVersion;

  return { func, endIdx: idx };
}

/**
 * Parse CallableVersion array from method call
 */
function parseVersions(fullCall: string): CallableVersion[] {
  const versions: CallableVersion[] = [];

  // Check if it has a simple return type + parameters without braces
  // Pattern: Type.XXX, new Type[0] or Type.XXX, new Type[] {...}
  const simplePattern =
    /,\s*(Type\.[A-Z_]+)\s*,\s*new\s+Type\s*\[\s*\d*\s*\]\s*(?:\{([^}]*)\})?/;
  let match = simplePattern.exec(fullCall);

  if (match && !fullCall.includes("new CallableVersion")) {
    const returnType = parseType(match[1]);
    const paramsStr = (match[2] || "").trim();
    const parameters =
      paramsStr.length > 0
        ? paramsStr.split(",").map((p) => parseType(p.trim()))
        : [];

    versions.push({ returnType, parameters });
    return versions;
  }

  // Check for CallableVersion array
  // Pattern: new CallableVersion[] { new CallableVersion(...), ... }
  const versionPattern = /new\s+CallableVersion\s*\[\]\s*\{([^}]+)\}/;
  match = versionPattern.exec(fullCall);

  if (!match) {
    return versions;
  }

  const versionsStr = match[1];

  // Split by "new CallableVersion"
  const versionCalls = versionsStr
    .split(/new\s+CallableVersion\s*\(/)
    .filter((v) => v.trim());

  for (const versionCall of versionCalls) {
    // Parse: Type.XXX, new Type[] { Type.YYY, ... }
    // or just: Type.XXX

    const withParamsMatch = versionCall.match(
      /(Type\.[A-Z_a-z().,<> |]+)\s*,\s*new\s+Type\s*\[\]\s*\{([^}]*)\}/
    );
    if (withParamsMatch) {
      const returnType = parseType(withParamsMatch[1].trim());
      const paramsStr = withParamsMatch[2].trim();
      const parameters =
        paramsStr.length > 0
          ? paramsStr.split(",").map((p) => parseType(p.trim()))
          : [];

      versions.push({ returnType, parameters });
      continue;
    }

    // Try pattern without parameters
    const noParamsMatch = versionCall.match(
      /(Type\.[A-Z_a-z().,<> |]+)\s*[,)]/
    );
    if (noParamsMatch) {
      const returnType = parseType(noParamsMatch[1].trim());
      versions.push({ returnType, parameters: [] });
    }
  }

  return versions;
}

/**
 * Extract all functions from FightFunctions.java
 */
function extractFunctions(javaFilePath: string): ExtractedFunctions {
  const content = fs.readFileSync(javaFilePath, "utf-8");
  const lines = content.split("\n");

  const functions: { [name: string]: FunctionDefinition } = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for method() calls
    if (line.startsWith("method(")) {
      const { func, endIdx } = parseMethodCall(lines, i);
      if (func) {
        functions[func.name] = func;
      }
      i = endIdx + 1;
    } else {
      i++;
    }
  }

  // Extract version from comment at top of file
  const versionMatch = content.match(/leek-wars-generator version ([\d.]+)/);
  const version = versionMatch ? versionMatch[1] : "unknown";

  return {
    version,
    extractedAt: new Date().toISOString(),
    functions,
  };
}

/**
 * Main execution
 */
function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const extractedDir = path.join(__dirname, "..", "extracted");

  const javaFilePath = path.join(dataDir, "FightFunctions.java");
  const outputPath = path.join(extractedDir, "fight-functions.json");

  console.log("Extracting functions from:", javaFilePath);

  if (!fs.existsSync(javaFilePath)) {
    console.error("Error: FightFunctions.java not found at:", javaFilePath);
    process.exit(1);
  }

  // Extract functions
  const extracted = extractFunctions(javaFilePath);

  console.log(`Extracted ${Object.keys(extracted.functions).length} functions`);
  console.log(`Generator version: ${extracted.version}`);

  // Ensure extracted directory exists
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir, { recursive: true });
  }

  // Write to JSON file
  fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2), "utf-8");

  console.log("Extracted functions written to:", outputPath);

  // Print some sample functions
  console.log("\nSample functions:");
  const sampleNames = ["getLeekID", "getName", "useWeapon", "getNearestEnemy"];
  for (const name of sampleNames) {
    const func = extracted.functions[name];
    if (func) {
      console.log(`  ${name}:`);
      console.log(`    Category: ${func.category}`);
      console.log(`    Operations: ${func.operations}`);
      console.log(`    Versions: ${func.versions.length}`);
      func.versions.forEach((v, i) => {
        const params =
          v.parameters.length > 0 ? v.parameters.join(", ") : "void";
        console.log(`      [${i}] (${params}) => ${v.returnType}`);
      });
    }
  }
}

main();
