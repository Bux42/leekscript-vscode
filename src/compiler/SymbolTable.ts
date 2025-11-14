/**
 * Symbol tables for tracking declarations during compilation
 * Tracks globals, functions, classes, and variable scopes
 */

import { FunctionInfo, ClassInfo, VariableInfo } from "./types";

/**
 * Scope for tracking variables
 */
export class Scope {
  private variables = new Map<string, VariableInfo>();
  private parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  /**
   * Register a variable in this scope
   */
  register(name: string, info: VariableInfo): void {
    this.variables.set(name, info);
  }

  /**
   * Look up a variable in this scope or parent scopes
   */
  lookup(name: string): VariableInfo | null {
    const info = this.variables.get(name);
    if (info) {
      return info;
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return null;
  }

  /**
   * Check if a variable exists in this scope (not parent)
   */
  has(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Get parent scope
   */
  getParent(): Scope | null {
    return this.parent;
  }

  /**
   * Get all variables in this scope
   */
  getVariables(): Map<string, VariableInfo> {
    return this.variables;
  }
}

/**
 * Symbol table for tracking all declarations
 */
export class SymbolTable {
  // Global scope
  private globalScope = new Scope(null);

  // Current scope (for local variables)
  private currentScope = this.globalScope;

  // Function declarations
  private functions = new Map<string, FunctionInfo>();

  // User function declarations (name -> param count)
  // Used during first pass before full function info is available
  private userFunctionDeclarations = new Map<string, number>();

  // Class declarations
  private classes = new Map<string, ClassInfo>();

  // User class declarations (name only)
  // Used during first pass before full class info is available
  private userClassDeclarations = new Set<string>();

  // Global variables
  private globals = new Set<string>();

  /**
   * Push a new scope (entering a block/function)
   */
  pushScope(): void {
    this.currentScope = new Scope(this.currentScope);
  }

  /**
   * Pop current scope (leaving a block/function)
   */
  popScope(): void {
    if (this.currentScope.getParent()) {
      this.currentScope = this.currentScope.getParent()!;
    }
  }

  /**
   * Get current scope
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Reset to global scope
   */
  resetToGlobalScope(): void {
    this.currentScope = this.globalScope;
  }

  // ===== Variable Management =====

  /**
   * Register a variable in current scope
   */
  registerVariable(name: string, info: VariableInfo): void {
    this.currentScope.register(name, info);
  }

  /**
   * Look up a variable
   */
  lookupVariable(name: string): VariableInfo | null {
    return this.currentScope.lookup(name);
  }

  /**
   * Check if variable exists in current scope
   */
  hasVariableInCurrentScope(name: string): boolean {
    return this.currentScope.has(name);
  }

  // ===== Global Management =====

  /**
   * Register a global variable
   */
  registerGlobal(name: string): void {
    this.globals.add(name);
  }

  /**
   * Check if a name is a global
   */
  isGlobal(name: string): boolean {
    return this.globals.has(name);
  }

  /**
   * Get all globals
   */
  getGlobals(): Set<string> {
    return this.globals;
  }

  // ===== Function Management =====

  /**
   * Register a function declaration (first pass)
   */
  registerFunctionDeclaration(name: string, paramCount: number): void {
    this.userFunctionDeclarations.set(name, paramCount);
  }

  /**
   * Register a full function (with details)
   */
  registerFunction(name: string, info: FunctionInfo): void {
    this.functions.set(name, info);
  }

  /**
   * Look up a function
   */
  lookupFunction(name: string): FunctionInfo | null {
    return this.functions.get(name) || null;
  }

  /**
   * Check if function declaration exists (first pass)
   */
  hasFunctionDeclaration(name: string): boolean {
    return this.userFunctionDeclarations.has(name);
  }

  /**
   * Check if function exists
   */
  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Get function parameter count (from declaration)
   */
  getFunctionParamCount(name: string): number | null {
    return this.userFunctionDeclarations.get(name) || null;
  }

  /**
   * Get all functions
   */
  getFunctions(): Map<string, FunctionInfo> {
    return this.functions;
  }

  // ===== Class Management =====

  /**
   * Register a class declaration (first pass)
   */
  registerClassDeclaration(name: string): void {
    this.userClassDeclarations.add(name);
  }

  /**
   * Register a full class (with details)
   */
  registerClass(name: string, info: ClassInfo): void {
    this.classes.set(name, info);
  }

  /**
   * Look up a class
   */
  lookupClass(name: string): ClassInfo | null {
    return this.classes.get(name) || null;
  }

  /**
   * Check if class declaration exists (first pass)
   */
  hasClassDeclaration(name: string): boolean {
    return this.userClassDeclarations.has(name);
  }

  /**
   * Check if class exists
   */
  hasClass(name: string): boolean {
    return this.classes.has(name);
  }

  /**
   * Get all classes
   */
  getClasses(): Map<string, ClassInfo> {
    return this.classes;
  }

  // ===== Utility =====

  /**
   * Check if a name is available (not used by function, class, or global)
   */
  isNameAvailable(name: string): boolean {
    return (
      !this.hasFunction(name) &&
      !this.hasFunctionDeclaration(name) &&
      !this.hasClass(name) &&
      !this.hasClassDeclaration(name) &&
      !this.isGlobal(name)
    );
  }

  /**
   * Check if a global name is available
   */
  isGlobalNameAvailable(name: string): boolean {
    return !this.isGlobal(name) && this.isNameAvailable(name);
  }

  /**
   * Clear all symbols (for fresh compilation)
   */
  clear(): void {
    this.globalScope = new Scope(null);
    this.currentScope = this.globalScope;
    this.functions.clear();
    this.userFunctionDeclarations.clear();
    this.classes.clear();
    this.userClassDeclarations.clear();
    this.globals.clear();
  }
}
