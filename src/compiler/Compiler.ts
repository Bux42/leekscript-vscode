/**
 * Main compiler class for LeekScript
 * Ported from Java IACompiler.java
 */

import { AIFile, AnalyzeResult, Options, FunctionInfo } from "./types";
import { ErrorCollector, ErrorType } from "./ErrorSystem";
import { SymbolTable } from "./SymbolTable";
import { registerBuiltinFunctions } from "./BuiltinFunctions";

/**
 * Timeout for analysis (30 seconds)
 */
const TIMEOUT_MS = 30000;

/**
 * LeekScript Compiler
 *
 * Performs multi-pass compilation:
 * 1. First Pass: Discover includes, functions, classes, globals
 * 2. Second Pass: Build full AST
 * 3. PreAnalyze: Declare all symbols
 * 4. Analyze: Type checking and validation
 */
export class Compiler {
  private symbolTable: SymbolTable;
  private errorCollector: ErrorCollector;
  private startTime: number = 0;
  private functionStack: FunctionInfo[] = [];
  private loopDepth: number = 0;

  constructor() {
    this.symbolTable = new SymbolTable();
    this.errorCollector = new ErrorCollector();

    // Load built-in LeekWars functions
    registerBuiltinFunctions(this.symbolTable);
  }

  /**
   * Analyze an AI file
   *
   * @param ai The AI file to analyze
   * @param version LeekScript version
   * @param options Compilation options
   * @returns Analysis result with errors and included files
   */
  async analyze(
    ai: AIFile,
    version: number = 4,
    options?: Options
  ): Promise<AnalyzeResult> {
    const result: AnalyzeResult = {
      informations: [],
      informationsJSON: [],
      includedAIs: new Set<AIFile>(),
      success: false,
      parseTime: 0,
      analyzeTime: 0,
    };

    // Start timeout timer
    this.startTime = Date.now();

    try {
      // Clear previous errors
      ai.clearErrors();
      this.errorCollector.clearErrors();
      this.symbolTable.clear();

      // Re-register built-in functions after clear
      registerBuiltinFunctions(this.symbolTable);

      // Phase 1: Parsing (readCode)
      const parseStart = Date.now();
      await this.readCode(ai, version, options);
      const parseTime = Date.now() - parseStart;
      result.parseTime = parseTime;

      // Phase 2: Semantic Analysis
      const analyzeStart = Date.now();
      await this.analyzeCode(ai, version, options);
      const analyzeTime = Date.now() - analyzeStart;
      result.analyzeTime = analyzeTime;

      // Collect errors
      result.informations = this.errorCollector.getErrors();
      result.success = !this.errorCollector.hasErrors();

      // Convert to JSON array format (matching Java generator)
      result.informationsJSON = this.convertErrorsToJSON(result.informations);

      // TODO: Get included AIs from MainBlock
      // result.includedAIs = mainBlock.getIncludedAIs();

      console.log(
        `Compilation: parse=${parseTime}ms, analyze=${analyzeTime}ms`
      );
    } catch (error: any) {
      // Handle timeout or too many errors
      if (
        error.message === "AI_TIMEOUT" ||
        error.errorType === ErrorType.AI_TIMEOUT
      ) {
        result.tooMuchErrors = error;
      } else if (error.errorType === ErrorType.TOO_MUCH_ERRORS) {
        result.tooMuchErrors = error;
      } else {
        // Unexpected error
        console.error("Compilation error:", error);
        result.tooMuchErrors = error;
      }

      result.informations = this.errorCollector.getErrors();
      result.informationsJSON = this.convertErrorsToJSON(result.informations);
      result.success = false;
    }

    return result;
  }

  /**
   * Phase 1: Read and parse code
   * - First pass: discover declarations
   * - Second pass: build AST
   */
  private async readCode(
    ai: AIFile,
    version: number,
    options?: Options
  ): Promise<void> {
    this.checkTimeout();

    // Create main block
    const { MainBlock } = require("./blocks/MainBlock");
    const mainBlock = new MainBlock(ai, this, 1);

    // Create pass manager
    const { PassManager } = require("./PassManager");
    const passManager = new PassManager(
      ai,
      version,
      options || {
        version,
        strict: false,
        useCache: false,
        enableOperations: false,
        useExtra: false,
      },
      mainBlock,
      this
    );

    // First pass: discover declarations
    await passManager.firstPass();

    // Second pass: build AST
    await passManager.secondPass();

    // Store main block for analysis phase
    (this as any).mainBlock = mainBlock;
  }

  /**
   * Phase 2: Semantic analysis
   * - PreAnalyze: declare symbols
   * - Analyze: type check
   */
  private async analyzeCode(
    ai: AIFile,
    version: number,
    options?: Options
  ): Promise<void> {
    this.checkTimeout();

    const mainBlock = (this as any).mainBlock;
    if (!mainBlock) {
      console.error("No main block found for analysis");
      return;
    }

    // PreAnalyze phase: Register all symbols
    // - Declare classes
    // - Declare functions
    // - Declare globals
    // - PreAnalyze class bodies
    // - PreAnalyze function bodies
    // - PreAnalyze instructions
    try {
      mainBlock.preAnalyze(this);
    } catch (error) {
      console.error("Error during preAnalyze:", error);
      throw error;
    }

    this.checkTimeout();

    // Analyze phase: Type checking and validation
    // - Analyze classes
    // - Analyze functions
    // - Analyze instructions
    // - Type check everything
    try {
      mainBlock.analyze(this);
    } catch (error) {
      console.error("Error during analyze:", error);
      throw error;
    }
  }

  /**
   * Check if we've exceeded the timeout
   */
  private checkTimeout(): void {
    if (Date.now() - this.startTime > TIMEOUT_MS) {
      throw new Error("AI_TIMEOUT");
    }
  }

  /**
   * Check if analysis has been interrupted (timeout)
   */
  isInterrupted(): boolean {
    return Date.now() - this.startTime > TIMEOUT_MS;
  }

  /**
   * Get the symbol table
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Get the error collector
   */
  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Get the start time
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * Push a function onto the function stack
   * Called when entering a function during analysis
   */
  pushFunction(func: FunctionInfo): void {
    this.functionStack.push(func);
  }

  /**
   * Pop a function from the function stack
   * Called when exiting a function during analysis
   */
  popFunction(): FunctionInfo | undefined {
    return this.functionStack.pop();
  }

  /**
   * Get the current function being analyzed
   * Returns undefined if not inside a function
   */
  getCurrentFunction(): FunctionInfo | undefined {
    return this.functionStack.length > 0
      ? this.functionStack[this.functionStack.length - 1]
      : undefined;
  }

  /**
   * Enter a loop (for break/continue validation)
   */
  enterLoop(): void {
    this.loopDepth++;
  }

  /**
   * Exit a loop
   */
  exitLoop(): void {
    if (this.loopDepth > 0) {
      this.loopDepth--;
    }
  }

  /**
   * Check if currently inside a loop
   */
  isInLoop(): boolean {
    return this.loopDepth > 0;
  }

  /**
   * Convert AnalyzeError array to JSON format matching Java generator
   * Format: [level, fileId, startLine, startColumn, endLine, endColumn, errorType, params]
   */
  private convertErrorsToJSON(errors: any[]): any[][] {
    return errors.map((error) => {
      const jsonError: any[] = [
        error.level, // 0 = ERROR, 1 = WARNING
        error.file, // AI file ID
        error.location.startLine,
        error.location.startColumn,
        error.location.endLine,
        error.location.endColumn,
        error.errorType, // Error enum ordinal
      ];

      // Add parameters array if present and not empty
      if (error.parameters && error.parameters.length > 0) {
        jsonError.push(error.parameters);
      }

      return jsonError;
    });
  }
}
