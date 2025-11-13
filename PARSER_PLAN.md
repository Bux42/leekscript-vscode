# LeekScript TypeScript Parser Implementation Plan

## Project Overview

Port the official LeekScript Java compiler/parser to TypeScript with full test coverage to replace the current regex-based analyzer in the VSCode extension.

## Architecture Overview

### Java Codebase Structure

```
leekscript/
├── compiler/
│   ├── LeekScript.java          # Main compiler entry point
│   ├── LexicalParser.java       # Tokenizer/Lexer
│   ├── Token.java               # Token representation
│   ├── TokenType.java           # Token types enum
│   ├── expression/              # Expression AST nodes
│   ├── instruction/             # Statement AST nodes
│   ├── bloc/                    # Code blocks
│   └── resolver/                # Symbol resolution
├── runner/
│   └── AI.java                  # Execution runtime
└── common/
    └── Error.java               # Error handling
```

### TypeScript Project Structure (To Create)

```
leekscript-ts/
├── src/
│   ├── compiler/
│   │   ├── LeekScript.ts        # Main compiler API
│   │   ├── Lexer.ts             # Tokenizer
│   │   ├── Token.ts             # Token types
│   │   ├── Parser.ts            # AST builder
│   │   ├── Analyzer.ts          # Semantic analysis
│   │   ├── ast/                 # AST node types
│   │   │   ├── Expression.ts
│   │   │   ├── Statement.ts
│   │   │   ├── Literal.ts
│   │   │   └── ...
│   │   └── types/               # Type system
│   ├── runtime/                 # Interpreter (if needed)
│   └── common/
│       └── Error.ts
├── tests/
│   ├── TestCommon.ts            # Test infrastructure
│   ├── TestGeneral.ts
│   ├── TestNumber.ts
│   └── ...
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

- [ ] Set up TypeScript project with Jest
- [ ] Create basic error handling
- [ ] Implement Token and TokenType
- [ ] Port TestCommon infrastructure

### Phase 2: Lexical Analysis (Days 3-4)

- [ ] Implement Lexer class
- [ ] Token stream handling
- [ ] Handle all token types: keywords, operators, literals, identifiers
- [ ] Comment handling (single-line, multi-line)
- [ ] String literal parsing with escape sequences

### Phase 3: AST Foundation (Days 5-7)

- [ ] Create base AST node classes
- [ ] Expression nodes (binary ops, unary ops, literals, identifiers)
- [ ] Statement nodes (if, while, for, return, etc.)
- [ ] Function and class declarations
- [ ] Type annotations

### Phase 4: Parser Implementation (Days 8-12)

- [ ] Recursive descent parser
- [ ] Operator precedence handling
- [ ] Expression parsing (arithmetic, logical, comparison)
- [ ] Statement parsing
- [ ] Function declarations and calls
- [ ] Class definitions (fields, methods, constructors)
- [ ] Control flow (if/else, loops)
- [ ] Error recovery and reporting

### Phase 5: Semantic Analysis (Days 13-15)

- [ ] Type system implementation
- [ ] Symbol table and scope management
- [ ] Variable resolution
- [ ] Type checking
- [ ] Function signature validation
- [ ] Class member resolution
- [ ] Error detection (undefined variables, type mismatches, etc.)

### Phase 6: Test Implementation (Days 16-25)

Each test suite ported in order:

1. **TestGeneral + TestComments** (Day 16)

   - Basic parsing tests
   - Comment handling verification

2. **TestNumber, TestBoolean, TestString** (Day 17)

   - Literal parsing
   - Type inference for primitives

3. **TestOperators** (Day 18)

   - All operator types
   - Precedence rules

4. **TestArray, TestSet, TestMap, TestInterval** (Days 19-20)

   - Collection literals
   - Collection operations
   - Stress tests

5. **TestIf, TestLoops** (Day 21)

   - Control flow parsing
   - Block scoping

6. **TestFunction, TestClass, TestObject** (Days 22-23)

   - Function declarations and calls
   - Class definitions
   - Object instantiation
   - Stress tests

7. **TestReference, TestGlobals, TestSystem** (Day 24)

   - Variable references
   - Global scope
   - Built-in functions

8. **TestJSON, TestOperations, TestFiles, TestEuler** (Day 25)
   - Advanced features
   - Edge cases

### Phase 7: VSCode Integration (Days 26-28)

- [ ] Create API layer for VSCode extension
- [ ] Replace analyzer.ts with new parser
- [ ] Update hover provider to use new parser
- [ ] Update completion provider
- [ ] Update definition provider
- [ ] Update diagnostics
- [ ] Performance optimization for incremental parsing

### Phase 8: Final Polish (Days 29-30)

- [ ] Performance profiling and optimization
- [ ] Memory usage optimization
- [ ] Documentation
- [ ] Final testing and bug fixes

## Key Challenges & Solutions

### Challenge 1: Runtime Execution

**Issue**: Tests may require executing code, not just parsing
**Solution**:

- Option A: Implement basic interpreter for test execution
- Option B: Mock execution results where possible
- Option C: Focus on parsing/analysis, skip execution tests

### Challenge 2: Java vs TypeScript Differences

**Issue**: Java features (strong typing, enums) vs TypeScript
**Solution**:

- Use TypeScript enums for TokenType
- Use union types for AST node variants
- Leverage TypeScript type system for safety

### Challenge 3: Performance

**Issue**: Parser must be fast for real-time VSCode feedback
**Solution**:

- Incremental parsing (re-parse only changed sections)
- Cache AST for unchanged files
- Lazy evaluation where possible

### Challenge 4: Error Recovery

**Issue**: Parser must handle incomplete/invalid code gracefully
**Solution**:

- Error recovery mechanisms in parser
- Partial AST generation
- Continue parsing after errors

## Testing Strategy

### Unit Tests

- Each parser component tested independently
- Lexer tests: token generation
- Parser tests: AST generation
- Analyzer tests: type checking, errors

### Integration Tests

- Port all Java test cases exactly
- Ensure identical behavior
- Compare outputs where possible

### VSCode Extension Tests

- End-to-end testing with real .leek files
- Performance benchmarks
- User interaction testing

## Success Criteria

✅ All Java tests ported and passing
✅ Parser handles all LeekScript language features
✅ Error messages are helpful and accurate
✅ VSCode extension features work perfectly:

- Syntax highlighting
- Auto-completion
- Hover information
- Go to definition
- Error diagnostics
- Debounced real-time analysis
  ✅ Performance is acceptable (< 100ms for typical file)

## Timeline Estimate

- **Total**: ~30 days
- **Core Parser**: ~15 days
- **Tests**: ~10 days
- **Integration**: ~3 days
- **Polish**: ~2 days

## Next Steps

1. Create TypeScript project structure
2. Set up Jest testing framework
3. Port TestCommon.java
4. Implement Lexer with basic tests
5. Continue phase by phase...
