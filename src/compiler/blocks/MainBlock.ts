/**
 * Main block - represents the top-level code block
 * Ported from Java MainLeekBlock.java
 */

import { AbstractBlock, Instruction } from "./AbstractBlock";
import { Compiler } from "../Compiler";
import { AIFile, ClassInfo, FunctionInfo } from "../types";

/**
 * Main code block
 * Contains user functions, classes, globals, and main code
 */
export class MainBlock extends AbstractBlock {
  private ai: AIFile;
  private compiler: Compiler;

  // User-defined functions
  private userFunctions = new Map<string, FunctionInfo>();

  // User-defined classes
  private userClasses = new Map<string, ClassInfo>();
  private userClassesList: any[] = []; // ClassDeclarationInstruction objects

  // Global variables
  private globals = new Set<string>();
  private globalDeclarations: Instruction[] = [];

  // Included AIs (first pass and second pass)
  private includedFirstPass = new Set<AIFile>();
  private included = new Set<AIFile>();

  // Strict mode
  private strict: boolean = false;

  constructor(ai: AIFile, compiler: Compiler, line: number = 1) {
    super(line, false);
    this.ai = ai;
    this.compiler = compiler;
    this.strict = ai.strict;
  }

  /**
   * Get the AI file
   */
  getAI(): AIFile {
    return this.ai;
  }

  /**
   * Check if strict mode is enabled
   */
  isStrict(): boolean {
    return this.strict;
  }

  // ===== Function Management =====

  /**
   * Add a function declaration (first pass)
   * Creates a FunctionBlock and stores it in the symbol table
   */
  addFunctionDeclaration(
    name: string,
    paramCount: number,
    parameters: string[] = []
  ): void {
    // Create FunctionBlock for this function
    const { FunctionBlock } = require("./FunctionBlock");

    const functionInfo: FunctionInfo = {
      name,
      paramCount,
      parameters,
      line: this.line,
      returnType: null,
    };

    const functionBlock = new FunctionBlock(functionInfo, this.line, true);
    functionInfo.block = functionBlock;

    // Register in symbol table
    this.compiler
      .getSymbolTable()
      .registerFunctionDeclaration(name, paramCount);
    this.compiler.getSymbolTable().registerFunction(name, functionInfo);
  }

  /**
   * Check if user function exists
   */
  hasUserFunction(name: string): boolean {
    return (
      this.compiler.getSymbolTable().hasFunction(name) ||
      this.compiler.getSymbolTable().hasFunctionDeclaration(name)
    );
  }

  /**
   * Add a full function
   */
  addFunction(name: string, info: FunctionInfo): void {
    this.userFunctions.set(name, info);
    this.compiler.getSymbolTable().registerFunction(name, info);
  }

  // ===== Class Management =====

  /**
   * Define a class (first pass) - overload for string
   */
  defineClass(name: string): void;
  /**
   * Define a class (first pass) - overload for class declaration object
   */
  defineClass(classDecl: any): void;
  defineClass(nameOrDecl: string | any): void {
    if (typeof nameOrDecl === "string") {
      // Simple name registration
      this.compiler.getSymbolTable().registerClassDeclaration(nameOrDecl);
    } else {
      // Full class declaration object
      this.userClassesList.push(nameOrDecl);
      this.compiler
        .getSymbolTable()
        .registerClassDeclaration(nameOrDecl.getName());
    }
  }

  /**
   * Get a defined class
   */
  getDefinedClass(name: string): ClassInfo | null {
    return this.compiler.getSymbolTable().lookupClass(name);
  }

  /**
   * Check if class exists
   */
  hasClass(name: string): boolean {
    return (
      this.compiler.getSymbolTable().hasClass(name) ||
      this.compiler.getSymbolTable().hasClassDeclaration(name)
    );
  }

  // ===== Global Management =====

  /**
   * Add a global variable
   */
  addGlobal(name: string): void {
    this.globals.add(name);
    this.compiler.getSymbolTable().registerGlobal(name);
  }

  /**
   * Check if global is declared
   */
  hasDeclaredGlobal(name: string): boolean {
    return this.globals.has(name);
  }

  /**
   * Add a global declaration instruction
   */
  addGlobalDeclaration(instruction: Instruction): void {
    this.globalDeclarations.push(instruction);
  }

  // ===== Include Management =====

  /**
   * Include an AI file (first pass)
   * Returns true if successful, false if not found
   */
  async includeAIFirstPass(path: string): Promise<boolean> {
    try {
      const includedAI = this.ai.getFolder().resolve(path);
      if (!includedAI) {
        return false;
      }

      // Check if already included
      if (this.includedFirstPass.has(includedAI)) {
        return true;
      }

      // Limit includes to prevent infinite loops
      if (this.includedFirstPass.size > 500) {
        throw new Error("Too many includes");
      }

      // Mark as included
      this.includedFirstPass.add(includedAI);

      // Recursively compile the included AI (first pass)
      const PassManager = require("../PassManager").PassManager;
      const passManager = new PassManager(
        includedAI,
        this.ai.version,
        this.ai.compilationOptions || {},
        this, // Same main block
        this.compiler
      );
      await passManager.firstPass();

      // Collect errors from included AI
      const errors = includedAI.errors || [];
      this.ai.errors.push(...errors);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Include an AI file (second pass)
   * Returns true if successful, false if not found
   */
  includeAI(path: string): boolean {
    try {
      const includedAI = this.ai.getFolder().resolve(path);
      if (!includedAI) {
        return false;
      }

      // Check if already included
      if (this.included.has(includedAI)) {
        return true;
      }

      // Limit includes
      if (this.included.size > 500) {
        throw new Error("Too many includes");
      }

      // Mark as included
      this.included.add(includedAI);

      // TODO: Recursively compile the included AI (second pass)
      // - Create new WordCompiler for included AI
      // - Run secondPass() on it
      // - Collect errors

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all included AIs
   */
  getIncludedAIs(): Set<AIFile> {
    return this.included;
  }

  // ===== Analysis =====

  /**
   * Pre-analyze phase
   */
  override preAnalyze(compiler: Compiler): void {
    // Declare all classes
    for (const clazz of this.userClassesList) {
      // TODO: clazz.declare(compiler);
    }

    // Declare all functions (already done in firstPass via registerFunction)
    // Functions are already in symbol table

    // Declare all globals
    for (const global of this.globalDeclarations) {
      global.preAnalyze(compiler);
    }

    // Pre-analyze classes
    for (const clazz of this.userClassesList) {
      // TODO: clazz.preAnalyze(compiler);
    }

    // Pre-analyze function bodies
    for (const [name, funcInfo] of this.userFunctions) {
      if (funcInfo.block) {
        funcInfo.block.preAnalyze(compiler);
      }
    }

    // Pre-analyze main block instructions
    super.preAnalyze(compiler);
  }

  /**
   * Analyze phase
   */
  override analyze(compiler: Compiler): void {
    // Analyze classes
    for (const clazz of this.userClassesList) {
      // TODO: clazz.analyze(compiler);
    }

    // Analyze function bodies
    for (const [name, funcInfo] of this.userFunctions) {
      if (funcInfo.block) {
        funcInfo.block.analyze(compiler);
      }
    }

    // Analyze main block instructions
    super.analyze(compiler);
  }
}
