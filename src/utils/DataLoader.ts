import * as path from "path";
import * as fs from "fs";

/**
 * Function data structure from functions.json
 */
export interface FunctionData {
  name: string;
  arguments_names: string[];
  arguments_types: number[];
  optional?: boolean[];
  return_type: number;
  return_name?: string;
  operations?: number;
}

/**
 * Constant data structure from constants.json
 */
export interface ConstantData {
  name: string;
  value: number | string;
}

/**
 * Type mappings for LeekScript built-in types
 */
export const TYPE_MAP: { [key: string]: string } = {
  "-1": "any",
  "1": "number",
  "2": "string",
  "3": "boolean",
  "4": "array",
  "41": "array<number>",
  "42": "array<string>",
  "43": "array<boolean>",
  "44": "array<array>",
  "46": "array<integer>",
  "47": "array<real>",
  "5": "function",
  "6": "integer",
  "7": "real",
  "8": "map",
};

/**
 * Service for loading and providing access to LeekScript language data
 */
export class DataLoader {
  private static instance: DataLoader | null = null;

  private functionsData: FunctionData[] = [];
  private constantsData: ConstantData[] = [];
  private docData: { [key: string]: string } = {};
  private leekscriptConstants: { [key: string]: string } = {};
  private builtInFunctions: Set<string> = new Set();

  private constructor(extensionPath: string) {
    this.loadData(extensionPath);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(extensionPath?: string): DataLoader {
    if (!DataLoader.instance) {
      if (!extensionPath) {
        throw new Error(
          "Extension path must be provided on first initialization"
        );
      }
      DataLoader.instance = new DataLoader(extensionPath);
    }
    return DataLoader.instance;
  }

  /**
   * Load all data from extracted JSON files
   */
  private loadData(extensionPath: string): void {
    const extractedPath = path.join(extensionPath, "extracted");

    this.functionsData = JSON.parse(
      fs.readFileSync(path.join(extractedPath, "functions.json"), "utf8")
    );

    this.constantsData = JSON.parse(
      fs.readFileSync(path.join(extractedPath, "constants.json"), "utf8")
    );

    this.docData = JSON.parse(
      fs.readFileSync(path.join(extractedPath, "doc.en.json"), "utf8")
    );

    this.leekscriptConstants = JSON.parse(
      fs.readFileSync(
        path.join(extractedPath, "leekscript_constants.json"),
        "utf8"
      )
    );

    // Build set of built-in function names
    this.builtInFunctions = new Set(this.functionsData.map((f) => f.name));
  }

  /**
   * Get all functions data
   */
  public getFunctions(): FunctionData[] {
    return this.functionsData;
  }

  /**
   * Get all constants data
   */
  public getConstants(): ConstantData[] {
    return this.constantsData;
  }

  /**
   * Get documentation data
   */
  public getDocData(): { [key: string]: string } {
    return this.docData;
  }

  /**
   * Get LeekScript constants (error messages, etc.)
   */
  public getLeekScriptConstants(): { [key: string]: string } {
    return this.leekscriptConstants;
  }

  /**
   * Get built-in functions set
   */
  public getBuiltInFunctions(): Set<string> {
    return this.builtInFunctions;
  }

  /**
   * Find a function by name
   */
  public findFunction(name: string): FunctionData | undefined {
    return this.functionsData.find((f) => f.name === name);
  }

  /**
   * Find a constant by name
   */
  public findConstant(name: string): ConstantData | undefined {
    return this.constantsData.find((c) => c.name === name);
  }

  /**
   * Get type name from type ID
   */
  public static getTypeName(typeId: string | number): string {
    return TYPE_MAP[typeId.toString()] || "any";
  }
}
