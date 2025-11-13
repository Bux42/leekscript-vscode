/**
 * Symbol Table for LeekScript
 * Tracks variables, functions, and classes with scope management
 */

import { Type } from "../types/Type";

export enum SymbolKind {
  VARIABLE = "variable",
  GLOBAL = "global",
  FUNCTION = "function",
  PARAMETER = "parameter",
  CLASS = "class",
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  type: Type;
  line: number;
  column: number;
  constant?: boolean; // For const/final variables
  initialized?: boolean; // Whether the variable has been initialized
}

/**
 * Scope represents a lexical scope in the program
 */
export class Scope {
  private symbols = new Map<string, Symbol>();

  constructor(
    public readonly parent: Scope | null = null,
    public readonly kind: "global" | "function" | "block" | "class" = "block"
  ) {}

  /**
   * Declare a symbol in this scope
   * Returns false if the symbol already exists
   */
  declare(symbol: Symbol): boolean {
    if (this.symbols.has(symbol.name)) {
      return false;
    }
    this.symbols.set(symbol.name, symbol);
    return true;
  }

  /**
   * Lookup a symbol in this scope (not parent scopes)
   */
  lookup(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  /**
   * Resolve a symbol by searching this scope and parent scopes
   */
  resolve(name: string): Symbol | undefined {
    const symbol = this.symbols.get(name);
    if (symbol) return symbol;
    if (this.parent) return this.parent.resolve(name);
    return undefined;
  }

  /**
   * Check if a symbol exists in this scope (not parent scopes)
   */
  has(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Get all symbols in this scope
   */
  getSymbols(): Symbol[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Get all symbol names in this scope
   */
  getNames(): string[] {
    return Array.from(this.symbols.keys());
  }

  /**
   * Update a symbol's type
   */
  updateType(name: string, type: Type): boolean {
    const symbol = this.symbols.get(name);
    if (!symbol) return false;
    symbol.type = type;
    return true;
  }

  /**
   * Mark a variable as initialized
   */
  markInitialized(name: string): boolean {
    const symbol = this.symbols.get(name);
    if (!symbol) return false;
    symbol.initialized = true;
    return true;
  }
}

/**
 * Symbol Table manages scopes and symbol resolution
 */
export class SymbolTable {
  private globalScope: Scope;
  private currentScope: Scope;
  private scopes: Scope[] = [];

  constructor() {
    this.globalScope = new Scope(null, "global");
    this.currentScope = this.globalScope;
    this.scopes.push(this.globalScope);
  }

  /**
   * Enter a new scope
   */
  enterScope(kind: "function" | "block" | "class" = "block"): Scope {
    const newScope = new Scope(this.currentScope, kind);
    this.currentScope = newScope;
    this.scopes.push(newScope);
    return newScope;
  }

  /**
   * Exit the current scope
   */
  exitScope(): Scope | null {
    if (this.currentScope === this.globalScope) {
      throw new Error("Cannot exit global scope");
    }
    const oldScope = this.currentScope;
    this.scopes.pop();
    this.currentScope = this.currentScope.parent!;
    return oldScope;
  }

  /**
   * Get the current scope
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Get the global scope
   */
  getGlobalScope(): Scope {
    return this.globalScope;
  }

  /**
   * Declare a variable in the current scope
   */
  declareVariable(
    name: string,
    type: Type,
    line: number,
    column: number,
    constant: boolean = false,
    initialized: boolean = false
  ): boolean {
    const symbol: Symbol = {
      name,
      kind: SymbolKind.VARIABLE,
      type,
      line,
      column,
      constant,
      initialized,
    };
    return this.currentScope.declare(symbol);
  }

  /**
   * Declare a global variable
   */
  declareGlobal(
    name: string,
    type: Type,
    line: number,
    column: number,
    initialized: boolean = false
  ): boolean {
    const symbol: Symbol = {
      name,
      kind: SymbolKind.GLOBAL,
      type,
      line,
      column,
      initialized,
    };
    return this.globalScope.declare(symbol);
  }

  /**
   * Declare a function in the current scope
   */
  declareFunction(
    name: string,
    type: Type,
    line: number,
    column: number
  ): boolean {
    const symbol: Symbol = {
      name,
      kind: SymbolKind.FUNCTION,
      type,
      line,
      column,
      initialized: true, // Functions are always initialized
    };
    return this.currentScope.declare(symbol);
  }

  /**
   * Declare a parameter in the current scope
   */
  declareParameter(
    name: string,
    type: Type,
    line: number,
    column: number
  ): boolean {
    const symbol: Symbol = {
      name,
      kind: SymbolKind.PARAMETER,
      type,
      line,
      column,
      initialized: true, // Parameters are always initialized
    };
    return this.currentScope.declare(symbol);
  }

  /**
   * Declare a class in the current scope
   */
  declareClass(
    name: string,
    type: Type,
    line: number,
    column: number
  ): boolean {
    const symbol: Symbol = {
      name,
      kind: SymbolKind.CLASS,
      type,
      line,
      column,
      initialized: true, // Classes are always initialized
    };
    return this.currentScope.declare(symbol);
  }

  /**
   * Lookup a symbol in the current scope only
   */
  lookup(name: string): Symbol | undefined {
    return this.currentScope.lookup(name);
  }

  /**
   * Resolve a symbol by searching current and parent scopes
   */
  resolve(name: string): Symbol | undefined {
    return this.currentScope.resolve(name);
  }

  /**
   * Check if a symbol is declared in the current scope
   */
  isDeclared(name: string): boolean {
    return this.currentScope.has(name);
  }

  /**
   * Check if a symbol is defined (declared and initialized)
   */
  isDefined(name: string): boolean {
    const symbol = this.resolve(name);
    return symbol !== undefined && (symbol.initialized ?? false);
  }

  /**
   * Update a variable's type
   */
  updateType(name: string, type: Type): boolean {
    return this.currentScope.updateType(name, type);
  }

  /**
   * Mark a variable as initialized
   */
  markInitialized(name: string): boolean {
    // Try current scope first
    if (this.currentScope.markInitialized(name)) {
      return true;
    }
    // Try to find in parent scopes and mark there
    const symbol = this.resolve(name);
    if (symbol) {
      symbol.initialized = true;
      return true;
    }
    return false;
  }

  /**
   * Check if we're in the global scope
   */
  isGlobalScope(): boolean {
    return this.currentScope === this.globalScope;
  }

  /**
   * Check if we're in a function scope
   */
  isInFunction(): boolean {
    let scope: Scope | null = this.currentScope;
    while (scope) {
      if (scope.kind === "function") return true;
      scope = scope.parent;
    }
    return false;
  }

  /**
   * Check if we're in a loop (for break/continue validation)
   */
  isInLoop(): boolean {
    // Note: This is a simplified version
    // In a full implementation, you'd track loop scopes specifically
    // For now, we'll just return true if we're not in global scope
    return !this.isGlobalScope();
  }

  /**
   * Get the nearest function scope
   */
  getNearestFunctionScope(): Scope | null {
    let scope: Scope | null = this.currentScope;
    while (scope) {
      if (scope.kind === "function") return scope;
      scope = scope.parent;
    }
    return null;
  }

  /**
   * Get all symbols in all scopes (for debugging)
   */
  getAllSymbols(): Map<string, Symbol[]> {
    const result = new Map<string, Symbol[]>();
    for (const scope of this.scopes) {
      for (const symbol of scope.getSymbols()) {
        const list = result.get(symbol.name) || [];
        list.push(symbol);
        result.set(symbol.name, list);
      }
    }
    return result;
  }

  /**
   * Reset the symbol table
   */
  reset(): void {
    this.globalScope = new Scope(null, "global");
    this.currentScope = this.globalScope;
    this.scopes = [this.globalScope];
  }
}
