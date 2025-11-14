# LeekScript Compiler

This directory contains the TypeScript implementation of the LeekScript static analyzer, ported from the Java `IACompiler` class.

## Architecture

The compiler uses a multi-pass architecture:

1. **First Pass** - Scan declarations (functions, classes, globals, includes)
2. **Second Pass** - Build full AST with all includes resolved
3. **PreAnalyze Phase** - Register symbols in symbol tables
4. **Analyze Phase** - Type checking and semantic analysis

## Components

### Core Infrastructure

- **types.ts** - TypeScript type definitions for the entire compiler

  - `AnalyzeResult`, `AnalyzeError`, `Location`, `AIFile`, `Folder`, etc.
  - Core interfaces used throughout the compiler

- **ErrorSystem.ts** - Error collection and formatting

  - `ErrorType` enum with 146 error types (matching Java)
  - `ErrorCollector` class for accumulating errors
  - JSON serialization matching Java format
  - Overloaded addError() for flexible error reporting

- **SymbolTable.ts** - Symbol tracking across scopes

  - `Scope` class for variable lookup with parent chain
  - `SymbolTable` for managing functions, classes, globals, variables
  - Scope push/pop for block-level scoping

- **Folder.ts** - Include path resolution

  - Resolves absolute paths (`/file.leek`)
  - Resolves relative paths (`./file.leek`, `../file.leek`)
  - Handles subfolders (`folder/file.leek`)
  - Supports escaped slashes for legacy AI names

- **Compiler.ts** - Main compilation entry point

  - `analyze()` method with 30-second timeout
  - Orchestrates all compilation phases
  - Returns `AnalyzeResult` with errors and timing
  - Integrates with PassManager for multi-pass parsing
  - Function stack tracking with `pushFunction()`, `popFunction()`, `getCurrentFunction()`
  - Loop depth tracking with `enterLoop()`, `exitLoop()`, `isInLoop()` for break/continue validation
  - Calls `mainBlock.preAnalyze()` and `mainBlock.analyze()` in analyzeCode()

- **PassManager.ts** - Multi-pass parsing implementation
  - `firstPass()` - Scans for includes, globals, functions (creates FunctionBlocks), classes
  - `secondPass()` - Converts leekscript-ts AST to Instruction/Block structure
  - `convertStatement()` - Maps AST node types to our instruction classes
  - Supports: variables, returns, expressions, globals, if/while/for/dowhile, break/continue
  - Populates function bodies by converting AST BlockStatement nodes
  - Recursive include resolution with circular detection
  - Token stream navigation and expression skipping

### Analysis Module

- **analysis/ExpressionAnalyzer.ts** - Expression type analysis and checking
  - `analyzeExpression()` - Dispatches to specific analyzers based on expression type
  - Literal analyzers - NumberLiteral, StringLiteral, BooleanLiteral, NullLiteral
  - `analyzeArrayLiteral()` - Infers array element types
  - `analyzeIdentifier()` - Resolves variables, functions, classes, globals
  - `analyzeBinaryExpression()` - Type checking for arithmetic, comparison, logical, bitwise operators
  - `analyzeUnaryExpression()` - Type checking for unary operators
  - `analyzeAssignmentExpression()` - Assignment type compatibility checking
  - `analyzeCallExpression()` - Function call analysis (in progress)
  - `analyzeMemberExpression()` - Object member access (in progress)
  - `analyzeArrayAccessExpression()` - Array indexing (in progress)
  - `analyzeTernaryExpression()` - Ternary operator type inference
  - `analyzeFunctionExpression()` - Lambda/closure analysis
  - Result caching using WeakMap for performance

### Block System

Represents code structure:

- **AbstractBlock** - Base class with instruction list
- **MainBlock** - Top-level code with functions, classes, globals, includes
- **FunctionBlock** - Function bodies with parameter scope
  - Pushes/pops function context on compiler stack
  - Enables return type checking via `getCurrentFunction()`
- **IfBlock** - Conditional execution with optional else
- **WhileBlock** - While loops
- **ForBlock** - For loops with init, condition, increment
- **DoWhileBlock** - Do-while loops

Each block has:

- `preAnalyze(compiler)` - Register symbols
- `analyze(compiler)` - Type checking and semantic analysis
- `endInstruction(compiler)` - Block completion logic

### Instruction System

Individual statement types:

- **VariableDeclarationInstruction** - `var`, `let`, `const` declarations
- **ReturnInstruction** - Return statements (including `return?`)
  - Checks return type compatibility with function signature
  - Reports INCOMPATIBLE_TYPE and DANGEROUS_CONVERSION errors
- **ExpressionInstruction** - Expression statements
- **GlobalDeclarationInstruction** - Global variable declarations
- **BreakInstruction** - Break statements
  - Validates it's inside a loop (reports BREAK_OUT_OF_LOOP)
- **ContinueInstruction** - Continue statements
  - Validates it's inside a loop (reports CONTINUE_OUT_OF_LOOP)

Each instruction has:

- `preAnalyze(compiler)` - Register symbols and infer types using ExpressionAnalyzer
- `analyze(compiler)` - Full type checking and error reporting

**PreAnalyze Implementation:**

- VariableDeclarationInstruction - Registers variables with inferred types, checks name availability
- GlobalDeclarationInstruction - Registers globals, analyzes initialization expressions
- ReturnInstruction - Analyzes return values (function signature checking TODO)
- ExpressionInstruction - Analyzes wrapped expressions
- Control flow blocks (If, While, For, DoWhile) - Analyze conditions and maintain scopes

### Type System

Complete type hierarchy for type checking:

- **Type** - Base class with static primitive types

  - `ERROR`, `WARNING`, `VOID`, `ANY`, `NULL`
  - `BOOL`, `INT`, `REAL`, `STRING`
  - `OBJECT`, `FUNCTION`, `ARRAY`, `MAP`, `SET`, `CLASS`
  - Compound types: `INT_OR_NULL`, `BOOL_OR_NULL`, etc.

- **CastType** - Type compatibility enum

  - `EQUALS` (0) - Exact match
  - `UPCAST` (1) - Safe widening (int → any)
  - `SAFE_DOWNCAST` (2) - Safe narrowing (int ↔ real)
  - `UNSAFE_DOWNCAST` (3) - Unsafe narrowing (any → int)
  - `INCOMPATIBLE` (4) - Cannot cast

- Specialized types:
  - **CompoundType** - Union types (`int|null`)
  - **ArrayType** - Arrays with element type
  - **MapType** - Maps with key/value types
  - **FunctionType** - Functions with signature
  - **ClassType** - Class instances
  - **ClassValueType** - Class references
  - **SetType** - Sets with element type
  - **ObjectType** - Generic objects
  - **IntervalType** - Numeric ranges

## Usage

```typescript
import { Compiler } from "./compiler";
import { Folder } from "./compiler";

// Create root folder with files
const root = new Folder(null, "");
const file = { path: "/main.leek", code: "var x = 5" };
root.addFile(file);

// Create compiler with options
const compiler = new Compiler({
  enableWarnings: true,
  strict: false,
});

// Analyze code
const result = await compiler.analyze(file, root);

// Check results
if (result.success) {
  console.log(`Analysis completed in ${result.analyzeTime}ms`);
} else {
  for (const error of result.errors) {
    console.log(`${error.file}:${error.line}: ${error.message}`);
  }
}
```

## Implementation Status

### Completed ✅

- [x] Core type definitions
- [x] Error system with 146 error types
- [x] Symbol table with scoping
- [x] Compiler skeleton
- [x] Folder/include resolution
- [x] Block system (all block types)
- [x] Instruction system (all instruction types)
- [x] Type system (full type hierarchy)
- [x] First pass implementation (scan declarations, create FunctionBlocks)
- [x] Include resolution with recursive compilation
- [x] Expression analysis (ExpressionAnalyzer with type inference)
- [x] PreAnalyze phase (symbol registration and type inference)
- [x] Second pass implementation (AST → Instruction/Block conversion)
- [x] Function context tracking for return type checking

### Pending ⏳

- [ ] Testing and validation

## VSCode Integration

The compiler is integrated with the VSCode extension through `src/analyzer.ts`:

- **`LeekScriptAnalyzer.analyze()`** - Async method that uses the new Compiler
- **Error Conversion** - AnalyzeError[] → VSCode Diagnostics with proper severity levels
- **Error Messages** - ErrorMessages.ts provides human-readable error messages with parameter substitution
- **Include Support** - Ready for include resolution (currently returns null, needs LeekWars service integration)

## Key Design Decisions

1. **Token Type Placeholder** - Currently using `any` type for Token until leekscript-ts exports it properly

2. **Symbol Table Design** - Uses scope chain with parent references, similar to Java implementation

3. **Error Format** - Matches Java IACompiler JSON format for compatibility:

   ```json
   {
     "line": 5,
     "column": 10,
     "level": "error",
     "file": "/main.leek",
     "code": 45,
     "message": "Type mismatch"
   }
   ```

4. **Type System** - Complete port of Java Type class with `accepts()` method for type compatibility

5. **Timeout Handling** - 30-second maximum for analysis operations to prevent infinite loops

## References

- Java source: `IACompiler.java`, `WordCompiler.java`, `Type.java`
- LeekScript grammar: leekscript-ts package
- VSCode integration: `src/analyzer.ts`
