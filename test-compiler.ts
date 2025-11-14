/**
 * Test script to compare our TypeScript compiler output with Java generator
 * The generator is the ground truth - it uses the same LeekScript AICompiler
 */

import { Compiler } from "./src/compiler/Compiler";
import { AnalyzeErrorLevel, AnalyzeError } from "./src/compiler/types";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface GeneratorError {
  level: number;
  file: number;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  error: number;
  params: string[];
}

/**
 * Run the Java generator on a file and get ground truth errors
 * Returns array of arrays: [level, fileId, line, col, endLine, endCol, errorType, params?]
 */
function getGroundTruthErrors(filePath: string): any[][] {
  try {
    const output = execSync(
      `java -jar generator\\generator.jar --analyze "${filePath}"`,
      { encoding: "utf-8" }
    );

    // Generator now outputs just the error array
    const lines = output.trim().split("\n");
    const jsonLine = lines[lines.length - 1]; // Last line is the JSON

    if (jsonLine.trim() === "[]") {
      return [];
    }

    return JSON.parse(jsonLine);
  } catch (error) {
    console.error("Error running generator:", error);
    throw error;
  }
}

/**
 * Compare two error arrays and report differences
 * Error format: [level, fileId, line, col, endLine, endCol, errorType, params?]
 */
function compareErrors(
  groundTruth: any[][],
  tsErrors: any[][],
  filePath: string
): boolean {
  let passed = true;

  // Check count
  if (groundTruth.length !== tsErrors.length) {
    console.log(`❌ Error count mismatch!`);
    console.log(`   Ground truth: ${groundTruth.length} errors`);
    console.log(`   TypeScript:   ${tsErrors.length} errors`);
    passed = false;
  } else {
    console.log(`✅ Error count matches: ${groundTruth.length} errors`);
  }

  // Compare each error
  for (let i = 0; i < Math.max(groundTruth.length, tsErrors.length); i++) {
    const gt = groundTruth[i];
    const ts = tsErrors[i];

    if (!gt) {
      console.log(`❌ Extra error in TypeScript output at index ${i}:`);
      console.log(`   ${JSON.stringify(ts)}`);
      passed = false;
      continue;
    }

    if (!ts) {
      console.log(`❌ Missing error in TypeScript output at index ${i}:`);
      console.log(`   Expected: ${JSON.stringify(gt)}`);
      passed = false;
      continue;
    }

    // Array format: [level, fileId, line, col, endLine, endCol, errorType, params?]
    const gtLevel = gt[0];
    const gtFile = gt[1];
    const gtLine = gt[2];
    const gtCol = gt[3];
    const gtEndLine = gt[4];
    const gtEndCol = gt[5];
    const gtError = gt[6];
    const gtParams = gt[7] || [];

    const tsLevel = ts[0];
    const tsFile = ts[1];
    const tsLine = ts[2];
    const tsCol = ts[3];
    const tsEndLine = ts[4];
    const tsEndCol = ts[5];
    const tsError = ts[6];
    const tsParams = ts[7] || [];

    // Compare key fields
    if (gtError !== tsError) {
      console.log(`❌ Error type mismatch at index ${i}:`);
      console.log(`   Ground truth: error=${gtError}`);
      console.log(`   TypeScript:   error=${tsError}`);
      passed = false;
    }

    if (gtLine !== tsLine || gtCol !== tsCol) {
      console.log(`❌ Location mismatch at index ${i}:`);
      console.log(`   Ground truth: ${gtLine}:${gtCol}`);
      console.log(`   TypeScript:   ${tsLine}:${tsCol}`);
      passed = false;
    }

    if (gtLevel !== tsLevel) {
      console.log(`❌ Level mismatch at index ${i}:`);
      console.log(`   Ground truth: level=${gtLevel}`);
      console.log(`   TypeScript:   level=${tsLevel}`);
      passed = false;
    }
  }

  return passed;
}

async function testFile(filePath: string): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${path.basename(filePath)}`);
  console.log("=".repeat(60));

  // Step 1: Get ground truth from Java generator
  console.log("\n📋 Getting ground truth from Java generator...");
  const groundTruth = getGroundTruthErrors(filePath);
  console.log(`   Found ${groundTruth.length} error(s)`);

  // Step 2: Run TypeScript compiler
  console.log("\n🔧 Running TypeScript compiler...");

  const code = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);

  const folder: any = {
    path: path.dirname(filePath),
    getAIs: () => [],
    resolve: (includePath: string) => null,
  };

  const aiFile: any = {
    id: 267760113,
    path: fileName,
    code: code,
    version: 4,
    owner: 0,
    folder: folder,
    timestamp: Date.now(),
    strict: false,
    clearErrors: () => {},
    setTokenStream: (tokens: any) => {},
  };

  const compiler = new Compiler();
  const startTime = Date.now();
  let result;
  try {
    result = await compiler.analyze(aiFile, 2);
  } catch (error) {
    console.error("❌ Compilation error:", error);
    throw error;
  }
  const endTime = Date.now();

  console.log(`   Parse time: ${result.parseTime} ms`);
  console.log(`   Analyze time: ${result.analyzeTime} ms`);
  console.log(`   Total time: ${endTime - startTime} ms`);
  console.log(`   Found ${result.informations.length} error(s)`);

  // Check for parser/compilation errors that prevented analysis
  if (result.tooMuchErrors) {
    console.log(
      `   ⚠️  Compilation failed: ${
        result.tooMuchErrors.message || result.tooMuchErrors
      }`
    );

    // If ground truth has no errors but we had a parse error, this is a failure
    if (groundTruth.length === 0) {
      console.log(
        "\n❌ FAILED: Parser error but ground truth expects no errors"
      );
      console.log(
        "   This indicates the TypeScript parser doesn't support syntax that the Java parser does"
      );
      return false;
    }
  }

  // Step 3: Get TypeScript errors in JSON array format (matching Java generator)
  const tsErrors = result.informationsJSON || [];

  // Step 4: Compare results
  console.log("\n🔍 Comparing results...");
  const passed = compareErrors(groundTruth, tsErrors, filePath);

  if (passed) {
    console.log("\n✅ PASSED: TypeScript compiler matches ground truth!");
  } else {
    console.log("\n❌ FAILED: Differences found");
    console.log("\nGround truth:");
    console.log(JSON.stringify(groundTruth, null, 2));
    console.log("\nTypeScript output:");
    console.log(JSON.stringify(tsErrors, null, 2));
  }

  return passed;
}

async function main() {
  const testDir = "test-compiler-ground-truth";
  const testFiles = [
    // "basic_declare_integer_semicolon.leek",
    // "basic_declare_integer.leek",
    // "basic_errors.leek",
    // "basic_no_errors.leek",
    // "leek_stats_class.leek",
    "get_chip_effects.leek",
    // "basic_include.leek", // Skip include tests for now
    // "monte_carlo.leek", // Skip complex tests for now
  ];

  console.log("🚀 LeekScript Compiler Test Suite");
  console.log("Ground truth: Java generator (IACompiler)\n");

  let totalTests = 0;
  let passedTests = 0;

  for (const fileName of testFiles) {
    const filePath = path.join(testDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      continue;
    }

    totalTests++;
    const passed = await testFile(filePath);
    if (passed) {
      passedTests++;
    } else {
      // Stop on first failure
      console.log("\n⛔ Stopping tests after first failure");
      break;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Tests run: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);

  if (passedTests === totalTests) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed");
    process.exit(1);
  }
}

main().catch(console.error);
