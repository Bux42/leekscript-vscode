# LeekScript AI Analyzer Features

## Overview

I've successfully implemented code analysis features from the leek-wars browser editor (`ai.ts`) into the VSCode extension. The analyzer now provides intelligent IntelliSense for user-defined code elements.

## Implemented Features

### 1. **Comment Extraction** ✅

- Detects `/* */` style comments
- Parses JavaDoc-style documentation (`@param`, `@return`)
- Tracks TODO items in comments
- Maps comments to their associated code elements

### 2. **Include Detection** ✅

- Regex: `/include\s*\(\s*["'](.*?)["']\s*\)/gm`
- Detects all `include()` statements
- Stores included file paths

### 3. **User-Defined Function Detection** ✅

- Regex: `/function\s+(\w+)\s*\(([^]*?)\)\s*(?:=>)?(?:->)?\s*(.*)\s*{/gm`
- Extracts function name, parameters, and return types
- Parses parameter types from signatures
- Associates JavaDoc comments with functions
- Provides autocomplete with:
  - Function signature
  - Parameter descriptions
  - Return value descriptions
  - Line number where defined
  - Snippet insertion with parameter placeholders

### 4. **Class Detection** ✅

- Regex: `/class\s+(\w+)\s*(extends|{)/gm`
- Detects class declarations
- Parses class fields (static and instance)
- Parses class methods (static and instance)
- Associates JavaDoc comments with classes, fields, and methods
- Provides autocomplete for:
  - Class names
  - Field names (with type information)
  - Method names (with signatures)

### 5. **Global Variable Detection** ✅

- Regex: `/global\s+(?:.*\s+?)?(\w+)$/gm`
- Detects global variable declarations
- Shows them in autocomplete
- Provides hover information

### 6. **Argument Parsing** ✅

- Handles typed parameters: `number x, string y`
- Handles untyped parameters (defaults to `any`)
- Handles `@` prefix for references
- Handles generic types with `<>` brackets
- Properly splits parameters at commas

### 7. **JavaDoc Parsing** ✅

- Regex: `/^\s*@(\w+)(?:\s+([a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)\s*:?\s*)?(?:\s*:\s*)?(.*)$/`
- Parses `@param` with parameter names and descriptions
- Parses `@return` with return descriptions
- Parses other JavaDoc tags
- Associates descriptions with function parameters

### 8. **Real-Time Analysis** ✅

- Analyzes documents on open
- Analyzes documents on change (real-time as you type)
- Analyzes documents on save
- Cleans up when documents are closed

### 9. **Autocomplete Integration** ✅

Shows user-defined symbols in autocomplete:

- Functions with parameter snippets
- Classes
- Global variables
- Line numbers where defined
- Full JavaDoc documentation

### 10. **Hover Provider Integration** ✅

Hover over user-defined symbols to see:

- Full signature
- Line number
- JavaDoc description
- Parameter descriptions
- Return value description

### 11. **Diagnostic Collection** ✅

- Creates a diagnostic collection for problems
- Displays TODO count as informational diagnostic
- Ready for future error/warning detection
- Updates in real-time as code changes

## Code Structure

### `src/analyzer.ts`

- **`LeekScriptAnalyzer`** class: Main analyzer

  - `analyze()`: Orchestrates all analysis
  - `updateComments()`: Extracts comments
  - `updateIncludes()`: Detects includes
  - `updateFunctions()`: Parses user functions
  - `updateClasses()`: Parses classes with fields/methods
  - `updateGlobalVars()`: Parses global variables
  - `parseArguments()`: Handles parameter parsing
  - `parseJavadoc()`: Parses JavaDoc comments

- **Interfaces**: `LeekScriptFunction`, `LeekScriptClass`, `LeekScriptField`, `LeekScriptMethod`, `LeekScriptGlobal`, `LeekScriptProblem`

### `src/extension.ts` Updates

- **`documentAnalyzers`**: Map to store analyzer for each document
- **`diagnosticCollection`**: VSCode diagnostic collection for problems
- **`analyzeDocument()`**: Runs analysis on a document
- **`updateDiagnostics()`**: Updates problem diagnostics
- Enhanced completion provider to include user symbols
- Enhanced hover provider to show user symbol definitions
- Added document open/change/close listeners

## Example Usage

See `test-example.leek` for a complete example showing:

- JavaDoc comments
- User-defined functions with parameters
- Classes with fields and methods
- Static members
- Global variables
- Include statements

## Testing the Features

1. Open `test-example.leek` in VSCode
2. Try autocomplete (Ctrl+Space) - you'll see:
   - `calculateDamage` function with parameters
   - `CombatAI` class
   - `HEALTH_THRESHOLD` global
3. Hover over `calculateDamage` to see its documentation
4. Hover over `CombatAI` to see class info
5. Check the Problems panel - you'll see "1 TODO(s) found in comments"

## Future Enhancements

The analyzer is designed to be extensible. Future additions could include:

- Syntax error detection
- Type checking
- Undefined variable detection
- Dead code detection
- Cross-file symbol resolution (using includes)
- Go to definition
- Find all references
- Rename symbol refactoring
