/**
 * LeekScript Compiler
 * Main exports for the compiler module
 */

// Core types
export * from "./types";

// Error system
export * from "./ErrorSystem";

// Symbol tables
export * from "./SymbolTable";

// Folder system
export { Folder } from "./Folder";

// Main compiler
export { Compiler } from "./Compiler";

// Pass manager
export { PassManager } from "./PassManager";

// Blocks
export * from "./blocks";

// Instructions
export * from "./instructions";

// Type system
export * from "./type-system";

// Analysis
export * from "./analysis";
