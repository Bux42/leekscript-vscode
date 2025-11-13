// Main library exports
export { Token } from "./compiler/Token";
export { TokenType } from "./compiler/TokenType";
export { Lexer } from "./compiler/Lexer";
export { Parser } from "./compiler/Parser";

// AST Nodes
export * from "./compiler/ast";

// Type system
export * from "./compiler/types/Type";

// Semantic analysis
export { SemanticAnalyzer } from "./compiler/semantic/SemanticAnalyzer";
export { SymbolTable } from "./compiler/semantic/SymbolTable";

// Version
export const VERSION = "0.1.0";
