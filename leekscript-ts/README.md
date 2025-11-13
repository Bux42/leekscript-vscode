# LeekScript Parser

TypeScript parser library for the LeekScript programming language, ported from the official Java implementation.

## Project Structure

```
src/
  compiler/
    Token.ts          - Token representation
    TokenType.ts      - Token type enumeration
    Lexer.ts          - Lexical analyzer (tokenizer)
    Parser.ts         - Syntax parser (builds AST)
    AST/              - Abstract Syntax Tree node types
    Analyzer.ts       - Semantic analyzer (type checking, validation)
  index.ts            - Main library exports

tests/
  TestCommon.ts       - Test utilities and helpers
  General.test.ts     - General parsing tests
  Comments.test.ts    - Comment handling tests
  Number.test.ts      - Number literal tests
  Boolean.test.ts     - Boolean literal tests
  String.test.ts      - String literal tests
  Operators.test.ts   - Operator tests
  Array.test.ts       - Array tests
  ... (more test files)
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Watch mode for development
npm run watch
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Testing Strategy

This project uses Test-Driven Development (TDD), porting all 28 test suites from the official Java implementation. Each feature is implemented incrementally with tests passing before moving to the next feature.

## Implementation Phases

1. ✅ Project Setup - TypeScript project structure with Jest
2. ⏳ Test Infrastructure - Port TestCommon utilities
3. ⏳ Lexer - Tokenization
4. ⏳ AST Nodes - Syntax tree representation
5. ⏳ Parser - Build AST from tokens
6. ⏳ Analyzer - Semantic analysis and type checking
7. ⏳ Test Porting - Port all 28 test suites
8. ⏳ VSCode Integration - Use parser in extension

## Reference

Based on the official LeekScript compiler:
https://github.com/Bux42/leekscript-local
