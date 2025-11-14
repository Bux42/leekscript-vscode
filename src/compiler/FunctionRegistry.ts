/**
 * Registry of all built-in LeekScript functions
 *
 * Loaded from extracted JSON files generated from the Java generator project.
 * Provides lookup capabilities for function signature validation during analysis.
 */

import * as path from "path";
import * as fs from "fs";

export interface FunctionParameter {
  returnType: string;
  parameters: string[];
}

export interface FunctionDefinition {
  name: string;
  category: string;
  operations: number;
  isStatic: boolean;
  versions: FunctionParameter[];
  minVersion?: number;
  maxVersion?: number;
}

export interface FunctionDatabase {
  version: string;
  extractedAt: string;
  functions: Record<string, FunctionDefinition>;
}

export class FunctionRegistry {
  private coreFunctions: Map<string, FunctionDefinition> = new Map();
  private fightFunctions: Map<string, FunctionDefinition> = new Map();
  private allFunctions: Map<string, FunctionDefinition> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    // Load merged functions file
    const extractedDir = path.join(__dirname, "..", "..", "extracted");
    const allFunctionsPath = path.join(extractedDir, "all-functions.json");

    if (!fs.existsSync(allFunctionsPath)) {
      console.warn(
        "Function definitions not found. Run: npm run extract-functions"
      );
      return;
    }

    try {
      const content = fs.readFileSync(allFunctionsPath, "utf-8");
      const data = JSON.parse(content);

      // Load core functions
      if (data.coreFunctions) {
        for (const [name, func] of Object.entries(data.coreFunctions)) {
          this.coreFunctions.set(name, func as FunctionDefinition);
        }
      }

      // Load fight functions
      if (data.fightFunctions) {
        for (const [name, func] of Object.entries(data.fightFunctions)) {
          this.fightFunctions.set(name, func as FunctionDefinition);
        }
      }

      // Load all functions
      if (data.allFunctions) {
        for (const [name, func] of Object.entries(data.allFunctions)) {
          this.allFunctions.set(name, func as FunctionDefinition);
        }
      }

      console.log(
        `Loaded ${this.allFunctions.size} built-in functions (${this.coreFunctions.size} core + ${this.fightFunctions.size} fight)`
      );
    } catch (error) {
      console.error("Failed to load function definitions:", error);
    }
  }

  /**
   * Check if a function name is a built-in function
   */
  hasFunction(name: string): boolean {
    return this.allFunctions.has(name);
  }

  /**
   * Get function definition by name
   */
  getFunction(name: string): FunctionDefinition | undefined {
    return this.allFunctions.get(name);
  }

  /**
   * Check if function call matches any version signature
   * Returns matching version or undefined if no match
   */
  matchVersion(name: string, argCount: number): FunctionParameter | undefined {
    const func = this.getFunction(name);
    if (!func) return undefined;

    // Find version that matches argument count
    // Note: LeekScript allows implicit conversions, so this is a basic check
    for (const version of func.versions) {
      if (version.parameters.length === argCount) {
        return version;
      }

      // Handle varargs (if parameters.length === 0, might accept any)
      if (argCount === 0 && version.parameters.length === 0) {
        return version;
      }
    }

    return undefined;
  }

  /**
   * Get all versions for a function
   */
  getVersions(name: string): FunctionParameter[] {
    const func = this.getFunction(name);
    return func ? func.versions : [];
  }

  /**
   * Get function category (Value, Number, String, Entity, Weapon, etc.)
   */
  getCategory(name: string): string | undefined {
    const func = this.getFunction(name);
    return func?.category;
  }

  /**
   * Get operation cost
   */
  getOperations(name: string): number | undefined {
    const func = this.getFunction(name);
    return func?.operations;
  }

  /**
   * Check if function is static (most built-ins are)
   */
  isStatic(name: string): boolean {
    const func = this.getFunction(name);
    return func?.isStatic ?? false;
  }

  /**
   * Get all function names
   */
  getAllFunctionNames(): string[] {
    return Array.from(this.allFunctions.keys());
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: string): FunctionDefinition[] {
    const result: FunctionDefinition[] = [];
    for (const func of this.allFunctions.values()) {
      if (func.category === category) {
        result.push(func);
      }
    }
    return result;
  }
}

// Singleton instance
let registry: FunctionRegistry | null = null;

export function getFunctionRegistry(): FunctionRegistry {
  if (!registry) {
    registry = new FunctionRegistry();
  }
  return registry;
}
