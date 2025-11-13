/**
 * Test utilities and helpers for LeekScript parser tests
 * Ported from TestCommon.java
 */

export interface TestResult {
  success: boolean;
  actual: string;
  expected: string;
  error?: Error;
}

export class TestCase {
  enabled = true;
  versionMin = 1;
  versionMax = 999;
  maxOperations = Number.MAX_SAFE_INTEGER;
  debug = false;
  strict = false;

  constructor(public code: string, enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Test that code returns expected value
   */
  equals(expected: string): TestResult {
    // TODO: Implement when we have parser/runner
    return {
      success: false,
      actual: "",
      expected,
      error: new Error("Not implemented yet"),
    };
  }

  /**
   * Test that code produces expected error
   */
  error(errorType: string): TestResult {
    // TODO: Implement when we have parser/analyzer
    return {
      success: false,
      actual: "",
      expected: `error ${errorType}`,
      error: new Error("Not implemented yet"),
    };
  }

  /**
   * Test that code produces expected warning
   */
  warning(warningType: string): TestResult {
    // TODO: Implement when we have analyzer
    return {
      success: false,
      actual: "",
      expected: `warning ${warningType}`,
      error: new Error("Not implemented yet"),
    };
  }

  /**
   * Test that code produces any error
   */
  anyError(): TestResult {
    // TODO: Implement when we have parser/analyzer
    return {
      success: false,
      actual: "",
      expected: "any error",
      error: new Error("Not implemented yet"),
    };
  }

  /**
   * Test that numeric result is close to expected (within delta)
   */
  almost(expected: number, delta = 1e-10): TestResult {
    // TODO: Implement when we have parser/runner
    return {
      success: false,
      actual: "",
      expected: expected.toString(),
      error: new Error("Not implemented yet"),
    };
  }
}

/**
 * Test statistics tracker
 */
export class TestStats {
  tests = 0;
  success = 0;
  failures = 0;
  disabled = 0;
  failedTests: string[] = [];
  disabledTests: string[] = [];

  recordTest(name: string, passed: boolean, enabled = true): void {
    this.tests++;
    if (!enabled) {
      this.disabled++;
      this.disabledTests.push(name);
    } else if (passed) {
      this.success++;
    } else {
      this.failures++;
      this.failedTests.push(name);
    }
  }

  printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log(`Tests: ${this.tests}`);
    console.log(`Success: ${this.success} (${this.getSuccessRate()}%)`);
    console.log(`Failures: ${this.failures}`);
    console.log(`Disabled: ${this.disabled}`);

    if (this.failedTests.length > 0) {
      console.log("\nFailed tests:");
      this.failedTests.forEach((name) => console.log(`  - ${name}`));
    }

    if (this.disabledTests.length > 0) {
      console.log("\nDisabled tests:");
      this.disabledTests.forEach((name) => console.log(`  - ${name}`));
    }
    console.log("=".repeat(60));
  }

  getSuccessRate(): string {
    const enabledTests = this.tests - this.disabled;
    if (enabledTests === 0) return "0.00";
    return ((this.success / enabledTests) * 100).toFixed(2);
  }

  reset(): void {
    this.tests = 0;
    this.success = 0;
    this.failures = 0;
    this.disabled = 0;
    this.failedTests = [];
    this.disabledTests = [];
  }
}

/**
 * Global test stats instance
 */
export const globalStats = new TestStats();

/**
 * Helper to create a test case
 */
export function test(code: string, enabled = true): TestCase {
  return new TestCase(code, enabled);
}

/**
 * Assert helper
 */
export function assertEquals(
  actual: any,
  expected: any,
  message?: string
): void {
  if (actual !== expected) {
    const msg = message || `Expected ${expected} but got ${actual}`;
    throw new Error(msg);
  }
}

/**
 * Assert almost equal for floating point
 */
export function assertAlmostEqual(
  actual: number,
  expected: number,
  delta = 1e-10,
  message?: string
): void {
  if (Math.abs(actual - expected) > delta) {
    const msg =
      message ||
      `Expected ${expected} but got ${actual} (delta: ${Math.abs(
        actual - expected
      )})`;
    throw new Error(msg);
  }
}

/**
 * Assert that function throws
 */
export function assertThrows(fn: () => void, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || "Expected function to throw but it did not");
  }
}
