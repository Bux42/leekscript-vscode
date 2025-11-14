# IACompiler TypeScript Implementation Plan

## Overview

This document details the plan to reimplement the Java `IACompiler.analyze()` method and its entire compilation pipeline in TypeScript for the VSCode extension. This will provide comprehensive LeekScript analysis with proper error reporting, type checking, and include file handling.

---

## Current State Analysis

### What IACompiler.analyze() Does (Java)

The Java implementation follows this flow:

```java
public AnalyzeResult analyze(AIFile ai) {
    1. Create AnalyzeResult
    2. Start timeout timer (30 seconds)
    3. Clear previous errors from AIFile
    4. Create WordCompiler(ai, version, options)
    5. Create MainLeekBlock(compiler, compiler, ai)
    6. ⏱️ Time and call compiler.readCode()  // PARSING PHASE
    7. ⏱️ Time and call compiler.analyze()    // ANALYSIS PHASE
    8. Get includedAIs from MainLeekBlock
    9. Collect errors and format as JSON
    10. Return: {informations, includedAIs, success, tooMuchErrors}
}
```

### Compilation Pipeline (Multi-Pass)

#### Phase 1: readCode() - PARSING

```
readCode()
├── firstPass()
│   ├── parse() - Tokenize entire file with LexicalParser
│   ├── Scan for includes
│   │   └── includeAIFirstPass() - Recursively load included files
│   ├── Scan for global declarations
│   ├── Scan for function declarations (structure only)
│   │   └── Count parameters, register function names
│   └── Scan for class declarations (structure only)
│       └── Register class names
└── secondPass()
    ├── Reset token stream
    ├── Parse actual code structure
    │   └── compileWord() for each token
    │       ├── Variable declarations
    │       ├── Control flow (if/while/for/return)
    │       ├── Expressions
    │       ├── Function calls
    │       └── Class instantiations
    └── Build AST (blocks, instructions, expressions)
```

**Purpose of firstPass:**

- Discover all top-level declarations (includes, globals, functions, classes)
- Register names in symbol tables before detailed parsing
- Resolve include dependencies
- Build structure without semantic analysis

**Purpose of secondPass:**

- Build complete AST with all expressions
- Create instruction blocks (MainLeekBlock, IfBlock, WhileBlock, etc.)
- Parse expressions but don't analyze types yet

#### Phase 2: analyze() - SEMANTIC ANALYSIS

```
analyze()
├── Set current block to MainLeekBlock
├── mMain.preAnalyze(compiler)
│   ├── For each user class: clazz.declare(compiler)
│   ├── For each function: function.declare(compiler)
│   ├── For each global: global.declare(compiler)
│   ├── For each user class: clazz.preAnalyze(compiler)
│   │   └── Register class members, methods, constructors
│   ├── For each function: function.preAnalyze(compiler)
│   │   └── Register parameters, analyze function body structure
│   └── For each instruction: instruction.preAnalyze(compiler)
│       └── Register variables in scope
└── mMain.analyze(compiler)
    ├── For each user class: clazz.analyze(compiler)
    │   └── Type check class body, methods, fields
    ├── For each function: function.analyze(compiler)
    │   └── Type check function body
    └── For each instruction: instruction.analyze(compiler)
        ├── Type check expressions
        ├── Verify variable types
        ├── Check function call arguments
        ├── Validate assignments
        └── Report type mismatches
```

**Purpose of preAnalyze:**

- Declare all symbols (classes, functions, variables)
- Register variable types
- Build type information without checking compatibility
- Handle function types (closures)

**Purpose of analyze:**

- Type checking and validation
- Verify function call argument counts and types
- Check type compatibility in assignments
- Detect undefined variables, invalid operations
- Report all errors and warnings

### Key Data Structures

#### AnalyzeResult

```typescript
interface AnalyzeResult {
  informations: AnalyzeError[]; // Array of errors/warnings
  includedAIs: Set<AIFile>; // Set of included files
  success: boolean; // true if no errors
  tooMuchErrors?: Error; // Timeout or error limit exceeded
}
```

#### AnalyzeError

```typescript
interface AnalyzeError {
  level: AnalyzeErrorLevel; // ERROR = 0, WARNING = 1
  file: number; // AI file ID
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  errorType: number; // Error enum ordinal
  parameters: string[]; // Error message parameters
}

enum AnalyzeErrorLevel {
  ERROR = 0,
  WARNING = 1,
}
```

#### AIFile

```typescript
interface AIFile {
  id: number;
  path: string; // File name (e.g., "my_ai.leek")
  code: string;
  version: number;
  owner: number;
  folder: Folder; // Parent folder for resolving includes
  timestamp: number;
  strict: boolean;
  tokens?: TokenStream;
  errors: AnalyzeError[];
  compilationOptions?: Options;
}
```

#### Folder

```typescript
interface Folder {
  id: number;
  owner: number;
  name: string;
  parent: Folder | null; // Parent folder (null for root)
  root: Folder; // Root folder
  files: Map<string, AIFile>; // Files in this folder
  folders: Map<string, Folder>; // Subfolders
  timestamp: number;

  // Resolve a relative path from this folder
  resolve(path: string): AIFile | null;
}
```

#### Options

```typescript
interface Options {
  version: number; // LeekScript version
  strict: boolean; // Strict mode
  useCache: boolean;
  enableOperations: boolean;
  session?: any;
  useExtra: boolean; // Enable extra functions
}
```

### Include Resolution Mechanism

LeekScript supports including other AI files with relative/absolute paths:

```leekscript
include("./helper.leek")           // Same folder
include("../utils/math.leek")      // Parent folder
include("/shared/constants.leek")  // From root
include("subfolder/ai.leek")       // Subfolder
```

**Resolution Process:**

1. Parse `include("path")` statement in firstPass
2. Get current AIFile's `folder` property
3. Call `folder.resolve(path)` which:
   - If path starts with `/` → resolve from root folder
   - If path starts with `./` → remove prefix, resolve from current
   - If path starts with `../` → resolve from parent folder
   - Otherwise → look for subfolder/file recursively
4. If file found → call `includeAIFirstPass(compiler, ai)` which:
   - Checks if already included (circular include prevention)
   - Creates new WordCompiler for the included file
   - Runs `firstPass()` on included file (recursive)
   - Collects errors into main AI's error list
5. In secondPass, repeat with `includeAI()` → runs `secondPass()` on included file

**Circular Include Protection:**

- Track included files in `Set<AIFile>`
- Limit to 500 includes (prevents infinite loops)
- Each include is only processed once per pass

**Example Folder Structure:**

```
Root (id=0)
├── shared/
│   ├── constants.leek
│   └── utils.leek
├── ai/
│   ├── main.leek        (includes "../shared/utils.leek")
│   └── helper.leek
└── test/
    └── test.leek        (includes "/shared/constants.leek")
```

### Error Collection Mechanism

Errors are collected through:

```java
compiler.addError(new AnalyzeError(
    location,           // Token or Location
    level,              // ERROR or WARNING
    errorType,          // Error enum value
    parameters          // String array for message formatting
));
```

Then converted to JSON:

```json
{
  "level": 0,
  "file": 123,
  "line": 10,
  "column": 5,
  "endLine": 10,
  "endColumn": 15,
  "error": 42,
  "params": ["variable_name", "expected_type"]
}
```

---

## Implementation Strategy

### Phase 1: Core Infrastructure

**Goal:** Set up basic structures and interfaces

1. **Create TypeScript types** (`src/compiler/types.ts`)

   - `AnalyzeResult`
   - `AnalyzeError`
   - `AnalyzeErrorLevel`
   - `AIFile`
   - `Options`
   - `Location` (if not already exists)

2. **Create Compiler class** (`src/compiler/Compiler.ts`)

   - `analyze(ai: AIFile): Promise<AnalyzeResult>`
   - Error collection array
   - Timeout handling (30 seconds)
   - Integration with existing Parser/Lexer

3. **Create Symbol Tables** (`src/compiler/SymbolTable.ts`)

   - Global variable registry
   - Function name registry
   - Class name registry
   - Variable scope tracking

4. **Create Error System** (`src/compiler/ErrorSystem.ts`)
   - Error type enum (port from Java Error.java)
   - `addError(location, level, type, params)`
   - Error formatting and JSON conversion

### Phase 2: First Pass (Structure Discovery)

**Goal:** Discover all top-level declarations

1. **Enhance existing Parser** (`leekscript-ts/src/compiler/Parser.ts`)

   - Add `firstPass()` method
   - Scan for `include` statements
   - Extract function declarations (name + param count)
   - Extract class declarations (name only)
   - Extract global declarations
   - Register all names in symbol tables

2. **Include Handler** (`src/compiler/IncludeResolver.ts`)

   - Use `folder.resolve(path)` to resolve relative/absolute paths
   - Supports relative paths: `./file`, `../parent/file`
   - Supports absolute paths: `/root/folder/file`
   - Handles escaped slashes: `\/` in old AI names
   - Track included files (prevent circular includes)
   - Recursively analyze included files (firstPass then secondPass)
   - Integration with LeekWars API to fetch included AIs if not in folder structure

3. **Declaration Extractors**
   - `extractFunctionDeclarations(tokens): FunctionDecl[]`
   - `extractClassDeclarations(tokens): ClassDecl[]`
   - `extractGlobalDeclarations(tokens): GlobalDecl[]`

### Phase 3: Second Pass (AST Building)

**Goal:** Build complete AST with all instructions

1. **Block System** (`src/compiler/blocks/`)

   - `AbstractBlock` base class
   - `MainBlock` (main code block)
   - `FunctionBlock` (function body)
   - `IfBlock`, `WhileBlock`, `ForBlock`, `DoWhileBlock`
   - Block nesting and parent/child relationships

2. **Instruction System** (`src/compiler/instructions/`)

   - `Instruction` interface with `preAnalyze()` and `analyze()`
   - `VariableDeclarationInstruction`
   - `ReturnInstruction`
   - `ExpressionInstruction`
   - `GlobalDeclarationInstruction`
   - `IfInstruction`, `WhileInstruction`, etc.

3. **Expression System** (extend existing in `leekscript-ts/`)
   - Add `preAnalyze(compiler)` to all Expression types
   - Add `analyze(compiler)` to all Expression types
   - `FunctionCallExpression` - verify arg count, type check args
   - `VariableExpression` - resolve variable scope
   - `BinaryExpression` - type check operands
   - `MemberAccessExpression` - verify object fields/methods

### Phase 4: PreAnalyze (Symbol Declaration)

**Goal:** Register all symbols and types

1. **PreAnalyze for Classes**

   - Register class members (fields)
   - Register class methods (name, param count, return type)
   - Register constructors
   - Build class inheritance tree
   - Detect duplicate members

2. **PreAnalyze for Functions**

   - Register function parameters
   - Register local variables (first pass)
   - Build function type signature
   - Detect duplicate parameters

3. **PreAnalyze for Variables**
   - Register variable in current scope
   - Store declared type (if type annotation present)
   - Check name conflicts (local vs global vs parameter)

### Phase 5: Analyze (Type Checking)

**Goal:** Full semantic analysis and error reporting

1. **Type System** (`src/compiler/types/TypeSystem.ts`)

   - Type representations: `ANY`, `NULL`, `VOID`, `INTEGER`, `NUMBER`, `STRING`, `BOOLEAN`, `ARRAY`, `OBJECT`, `FUNCTION`, `CLASS`
   - Type compatibility checking
   - Type casting rules (UPCAST, DOWNCAST, DANGEROUS, INCOMPATIBLE)
   - `accepts(targetType, sourceType): CastType`

2. **Expression Analysis**

   - For each expression type:
     - Call `expr.analyze(compiler)`
     - Infer expression type
     - Check type compatibility with context
   - Function calls:
     - Verify function exists
     - Check argument count
     - Check argument types
     - Verify return type usage
   - Variable access:
     - Verify variable is declared
     - Get variable type from symbol table
     - Check if variable is in scope

3. **Instruction Analysis**

   - Variable declarations:
     - Check type annotation vs initializer type
     - Report incompatible types
     - Store inferred type in symbol table (strict mode)
   - Return statements:
     - Check return type matches function signature
   - Assignments:
     - Verify target is assignable (not constant)
     - Check type compatibility
   - Control flow:
     - Verify condition expressions are boolean-compatible

4. **Error Reporting**
   - Type mismatch in assignment
   - Type mismatch in function call arguments
   - Undefined variable/function/class
   - Invalid parameter count
   - Unreachable code
   - Type mismatch in operators
   - Non-callable expression

### Phase 6: Integration with VSCode Extension

**Goal:** Wire up new compiler to analyzer

1. **Update `src/analyzer.ts`**

   - Replace current simple analysis with new Compiler
   - Convert `AnalyzeError[]` to VSCode `Diagnostic[]`
   - Map error types to readable messages
   - Handle timeout errors

2. **Include Resolution Integration**

   - When analyzing an AI file, resolve includes
   - Fetch included AIs from workspace or API
   - Cache analyzed includes to avoid re-analysis
   - Report errors if included file not found

3. **Performance Optimization**
   - Implement incremental analysis (only re-analyze changed files)
   - Cache symbol tables for unchanged files
   - Implement timeout mechanism (30 seconds)
   - Add progress reporting for large files

### Phase 7: Testing

**Goal:** Ensure correctness

1. **Unit Tests**

   - Test first pass (declaration extraction)
   - Test second pass (AST building)
   - Test preAnalyze (symbol registration)
   - Test analyze (type checking)
   - Test error reporting

2. **Integration Tests**

   - Test full compilation pipeline
   - Test include handling
   - Test error messages
   - Compare results with Java implementation

3. **VSCode Extension Tests**
   - Test diagnostic reporting
   - Test error highlighting
   - Test hover information
   - Test include resolution

---

## Implementation Order (Detailed Steps)

### Step 1: Infrastructure (Week 1)

1. Create `src/compiler/types.ts` with all interfaces
2. Create `src/compiler/ErrorSystem.ts` with error types and formatting
3. Create `src/compiler/SymbolTable.ts` with registries
4. Create `src/compiler/Compiler.ts` with basic skeleton
5. Write tests for error formatting and symbol tables

### Step 2: First Pass (Week 2)

1. Create `src/compiler/Folder.ts` with `resolve()` method
2. Add `firstPass()` to Parser
3. Implement include scanning and resolution via `folder.resolve(path)`
4. Implement function declaration scanning (regex/token scanning)
5. Implement class declaration scanning (regex/token scanning)
6. Implement global declaration scanning (regex/token scanning)
7. Handle recursive includes (call `includeAIFirstPass()` on resolved files)
8. Write tests for declaration extraction and path resolution

### Step 3: Block System (Week 2-3)

1. Create `src/compiler/blocks/AbstractBlock.ts`
2. Create `src/compiler/blocks/MainBlock.ts`
3. Create `src/compiler/blocks/FunctionBlock.ts`
4. Create control flow blocks (If, While, For, DoWhile)
5. Implement block nesting and parent tracking
6. Write tests for block creation and nesting

### Step 4: Instruction System (Week 3-4)

1. Create `src/compiler/instructions/Instruction.ts` interface
2. Create `VariableDeclarationInstruction`
3. Create `ReturnInstruction`
4. Create `ExpressionInstruction`
5. Create control flow instructions
6. Add `preAnalyze()` and `analyze()` stubs to each
7. Write tests for instruction creation

### Step 5: Expression Enhancement (Week 4-5)

1. Add `preAnalyze()` method to all Expression classes in `leekscript-ts/`
2. Add `analyze()` method to all Expression classes
3. Implement type inference for each expression type
4. Implement `FunctionCallExpression.analyze()` with type checking
5. Implement `VariableExpression.analyze()` with scope resolution
6. Write tests for expression analysis

### Step 6: PreAnalyze Phase (Week 5-6)

1. Implement `MainBlock.preAnalyze()`
2. Implement `FunctionBlock.preAnalyze()` - register parameters
3. Implement `ClassDeclaration.preAnalyze()` - register members
4. Implement `VariableDeclaration.preAnalyze()` - register variables
5. Test symbol registration for various code patterns

### Step 7: Analyze Phase (Week 6-8)

1. Create `src/compiler/types/TypeSystem.ts`
2. Implement type compatibility checking
3. Implement `MainBlock.analyze()`
4. Implement `FunctionBlock.analyze()` - type check body
5. Implement `ClassDeclaration.analyze()` - type check members
6. Implement `VariableDeclaration.analyze()` - check type compatibility
7. Implement `FunctionCall.analyze()` - verify args
8. Test type checking for various error cases

### Step 8: Integration (Week 8-9)

1. Update `src/analyzer.ts` to use new Compiler
2. Convert `AnalyzeError[]` to `Diagnostic[]`
3. Create error message templates
4. Build Folder structure from LeekWars service data:
   - Use `createFolderStructure()` result (Map<folderId, path>)
   - Create Folder objects with proper parent/root relationships
   - Populate folders with AIFile objects
   - Each AIFile gets its `folder` property set
5. Add caching for analyzed files
6. Test end-to-end in VSCode with includes

### Step 9: Polish (Week 9-10)

1. Implement timeout handling
2. Add progress reporting
3. Optimize performance (incremental analysis)
4. Write comprehensive tests
5. Compare error messages with Java implementation
6. Document new system

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ VSCode Extension (analyzer.ts)                              │
│  - Receives document changes                                │
│  - Calls Compiler.analyze(aiFile)                           │
│  - Converts AnalyzeError[] to Diagnostic[]                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Compiler.analyze(aiFile)                                    │
│  - Start timeout timer                                      │
│  - Create WordCompiler instance                             │
│  - Create MainBlock                                         │
│  - Call readCode() → PARSING                                │
│  - Call analyze() → SEMANTIC ANALYSIS                       │
│  - Collect errors                                           │
│  - Return AnalyzeResult                                     │
└────────┬────────────────────────────┬───────────────────────┘
         │                            │
         ▼ readCode()                 ▼ analyze()
┌────────────────────────┐   ┌────────────────────────────────┐
│ First Pass             │   │ PreAnalyze Phase               │
│  - Tokenize (Lexer)    │   │  - MainBlock.preAnalyze()      │
│  - Scan includes       │   │    - Classes declare()         │
│  - Scan functions      │   │    - Functions declare()       │
│  - Scan classes        │   │    - Globals declare()         │
│  - Scan globals        │   │    - Classes preAnalyze()      │
│  - Register names      │   │    - Functions preAnalyze()    │
│  - Resolve includes    │   │    - Instructions preAnalyze() │
└────────┬───────────────┘   └────────┬───────────────────────┘
         │                            │
         ▼                            ▼
┌────────────────────────┐   ┌────────────────────────────────┐
│ Second Pass            │   │ Analyze Phase                  │
│  - Parse expressions   │   │  - MainBlock.analyze()         │
│  - Build AST           │   │    - Classes analyze()         │
│  - Create blocks       │   │    - Functions analyze()       │
│  - Create instructions │   │    - Instructions analyze()    │
│  - Link references     │   │  - Type check everything       │
│  - Build structure     │   │  - Report errors               │
└────────────────────────┘   └────────────────────────────────┘
```

---

## Error Reporting Examples

### Type Mismatch in Assignment

```leekscript
string s = 123;  // Error: incompatible type
```

**Error:**

```json
{
  "level": 0, // ERROR
  "line": 1,
  "column": 12,
  "endLine": 1,
  "endColumn": 15,
  "error": 42, // ASSIGNMENT_INCOMPATIBLE_TYPE
  "params": ["123", "number", "s", "string"]
}
```

### Invalid Function Call

```leekscript
function myFunc(a, b) {}
myFunc(1);  // Error: invalid parameter count
```

**Error:**

```json
{
  "level": 0, // ERROR
  "line": 2,
  "column": 1,
  "endLine": 2,
  "endColumn": 10,
  "error": 73, // INVALID_PARAMETER_COUNT
  "params": ["myFunc", "2", "1"]
}
```

### Undefined Variable

```leekscript
var x = unknownVar;  // Error: undefined variable
```

**Error:**

```json
{
  "level": 0, // ERROR
  "line": 1,
  "column": 9,
  "endLine": 1,
  "endColumn": 19,
  "error": 15, // UNDEFINED_VARIABLE
  "params": ["unknownVar"]
}
```

---

## Key Challenges & Solutions

### Challenge 1: Include Resolution

**Problem:** Included AIs need to be resolved using relative/absolute paths within folder structure  
**Solution:**

- Each AIFile has a `folder` property (from LeekWars service)
- Use `folder.resolve(path)` to resolve includes:
  - `/path` → resolve from root folder
  - `./path` → resolve from current folder
  - `../path` → resolve from parent folder
  - `folder/file` → resolve subfolder then file
- Handle escaped slashes (`\/`) in legacy AI names
- Track included files in Set to prevent circular includes (limit 500)
- Recursively compile included AIs:
  - `includeAIFirstPass()` → runs `firstPass()` on included file
  - `includeAI()` → runs `secondPass()` on included file
- Collect errors from included files into main AI's error list

### Challenge 2: Multi-Pass Complexity

**Problem:** Need to track state across multiple passes  
**Solution:**

- Use symbol tables that persist across passes
- Clear appropriate data at start of each pass
- Use flags to track which pass we're in
- Separate preAnalyze (registration) from analyze (validation)

### Challenge 3: Type System

**Problem:** Complex type compatibility rules  
**Solution:**

- Port Java Type classes to TypeScript
- Implement CastType enum (UPCAST, DOWNCAST, DANGEROUS, INCOMPATIBLE)
- Use `Type.accepts(Type)` method for compatibility
- Handle special cases (null, any, void)

### Challenge 4: Error Message Quality

**Problem:** Error messages need to be helpful  
**Solution:**

- Port all error types from Java Error.java
- Store error parameters (variable names, types, etc.)
- Format messages with context
- Include location information (line, column range)

### Challenge 5: Performance

**Problem:** Large files take time to analyze  
**Solution:**

- Implement 30-second timeout
- Cache analysis results for unchanged files
- Only re-analyze files that changed
- Use incremental analysis when possible

---

## Testing Strategy

### Unit Tests

1. **SymbolTable Tests**

   - Register and lookup functions
   - Register and lookup classes
   - Register and lookup variables
   - Scope resolution

2. **First Pass Tests**

   - Extract function declarations
   - Extract class declarations
   - Extract global declarations
   - Extract includes

3. **Type System Tests**

   - Type compatibility checking
   - Cast type determination
   - Type inference

4. **Error Formatting Tests**
   - Error to JSON conversion
   - Location tracking
   - Parameter formatting

### Integration Tests

1. **Full Compilation Tests**

   - Parse and analyze simple programs
   - Detect type errors
   - Detect undefined variables
   - Detect invalid function calls

2. **Include Tests**

   - Resolve includes from workspace
   - Handle missing includes
   - Detect circular includes

3. **VSCode Extension Tests**
   - Diagnostic conversion
   - Error highlighting in editor
   - Hover information
   - Real-time analysis on file change

### Comparison Tests

- Run same LeekScript code through Java and TypeScript compilers
- Compare error counts
- Compare error types
- Compare error locations

---

## Success Criteria

1. ✅ All 303 existing parser tests still pass
2. ✅ New compiler produces equivalent errors to Java implementation
3. ✅ Include resolution works for workspace and API files
4. ✅ Type checking catches all major type errors
5. ✅ Performance: Analyze typical AI in < 500ms
6. ✅ VSCode integration: Errors appear in Problems panel
7. ✅ VSCode integration: Red squiggles on error locations
8. ✅ Documentation: Implementation documented

---

## Future Enhancements (Post-MVP)

1. **Code Actions**

   - Quick fixes for common errors
   - Import suggestions
   - Type annotation suggestions

2. **Hover Information**

   - Variable type on hover
   - Function signature on hover
   - Documentation on hover

3. **Go to Definition**

   - Jump to variable declaration
   - Jump to function definition
   - Jump to class definition

4. **Autocomplete**

   - Variable names
   - Function names
   - Class members
   - System functions

5. **Refactoring**
   - Rename symbol
   - Extract function
   - Extract variable

---

## Timeline Estimate

**Total Time:** 10 weeks (assuming full-time work)

- Week 1: Infrastructure
- Week 2-3: First Pass + Blocks
- Week 3-4: Instructions
- Week 4-5: Expression Analysis
- Week 5-6: PreAnalyze
- Week 6-8: Analyze (Type Checking)
- Week 8-9: Integration
- Week 9-10: Testing + Polish

**Note:** This is an aggressive timeline. Add buffer for:

- Unexpected edge cases
- Java code understanding
- Debugging complex type issues
- Performance optimization

---

## Integration with LeekWars Service

Our existing `LeekWarsService` already provides the folder structure needed for include resolution:

### What We Have (from src/services/leekwars/)

1. **`pullAllAIs()`** returns folder structure and all AI files
2. **`createFolderStructure()`** returns `Map<number, string>` mapping folder IDs to paths
3. **API data includes:**
   - AI name, code, ID, owner
   - Folder ID for each AI
   - Folder hierarchy with parent relationships

### What We Need to Do

1. **Convert API data to Folder objects:**

   ```typescript
   // From LeekWars API response
   interface GetFarmerAIsResponse {
     ais: Array<{
       id: number;
       name: string;
       folder: number; // Folder ID
       // ...
     }>;
     folders: Array<{
       id: number;
       name: string;
       parent: number; // Parent folder ID (0 = root)
     }>;
   }

   // Build Folder tree
   function buildFolderTree(response: GetFarmerAIsResponse): Folder {
     const folders = new Map<number, Folder>();
     const root = new Folder(0, owner, ".", null, null);
     folders.set(0, root);

     // Create all folders
     for (const folderData of response.folders) {
       const parent = folders.get(folderData.parent)!;
       const folder = new Folder(
         folderData.id,
         owner,
         folderData.name,
         parent,
         root
       );
       folders.set(folderData.id, folder);
       parent.addFolder(folderData.name, folder);
     }

     // Add AI files to folders
     for (const aiData of response.ais) {
       const folder = folders.get(aiData.folder)!;
       const aiFile = new AIFile(
         aiData.name,
         aiData.code,
         Date.now(),
         1, // version
         folder,
         owner,
         aiData.id,
         false // strict
       );
       folder.addFile(aiData.name, aiFile);
     }

     return root;
   }
   ```

2. **Pass folder structure to analyzer:**
   - When analyzing a file, it already has its `folder` property
   - Includes are automatically resolved via `folder.resolve()`
   - No need to fetch from API during analysis (already cached)

### Benefits

- ✅ Folder structure already available from initial pull
- ✅ Include resolution works without API calls
- ✅ Matches Java implementation exactly
- ✅ Supports relative/absolute paths naturally

## Dependencies on Existing Code

### From leekscript-ts/

- **Lexer:** Tokenization
- **Parser:** Basic AST building (will be enhanced)
- **AST Nodes:** Expression, Statement, etc.
- **Token:** Token representation

### From src/

- **LeekWars Service:** Provides folder structure and AI files
- **LeekWars API:** Already fetches all data needed
- **Extension Context:** For caching and configuration

### New Dependencies (to add)

- None required, all can be implemented with existing TypeScript

---

## Key Files to Create

```
src/compiler/
├── Compiler.ts                  # Main compiler entry point
├── types.ts                     # Type definitions
├── ErrorSystem.ts               # Error collection and formatting
├── SymbolTable.ts              # Symbol registries
├── Folder.ts                    # Folder structure with resolve() method
├── blocks/
│   ├── AbstractBlock.ts        # Base block class
│   ├── MainBlock.ts            # Main code block
│   ├── FunctionBlock.ts        # Function body block
│   ├── IfBlock.ts              # If statement block
│   ├── WhileBlock.ts           # While loop block
│   ├── ForBlock.ts             # For loop block
│   └── DoWhileBlock.ts         # Do-while loop block
├── instructions/
│   ├── Instruction.ts          # Base instruction interface
│   ├── VariableDeclaration.ts  # Var/let/const declarations
│   ├── ReturnInstruction.ts    # Return statements
│   ├── ExpressionInstruction.ts # Expression statements
│   ├── GlobalDeclaration.ts    # Global variable declarations
│   └── ...                     # Other instruction types
├── types/
│   ├── TypeSystem.ts           # Type compatibility checking
│   ├── Type.ts                 # Type representations
│   └── CastType.ts             # Cast type enum
└── test/
    ├── Compiler.test.ts
    ├── SymbolTable.test.ts
    ├── FirstPass.test.ts
    ├── TypeSystem.test.ts
    └── Integration.test.ts
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for porting the Java IACompiler to TypeScript. The key is to follow the multi-pass architecture:

1. **First Pass:** Structure discovery (includes, functions, classes, globals)
2. **Second Pass:** AST building (parse all code)
3. **PreAnalyze:** Symbol registration (declare all symbols)
4. **Analyze:** Type checking and validation (full semantic analysis)

By breaking the work into these phases and following the detailed step-by-step plan, we can methodically implement each piece and test as we go. The result will be a robust LeekScript compiler in TypeScript that provides comprehensive error checking and type analysis for the VSCode extension.
