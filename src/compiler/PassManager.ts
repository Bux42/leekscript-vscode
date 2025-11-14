/**
 * First and Second Pass implementation for LeekScript Compiler
 *
 * Implements the multi-pass parsing strategy from WordCompiler.java:
 * 1. First Pass - Scan for includes, globals, functions, classes
 * 2. Second Pass - Build full AST
 */

import { Lexer } from "../../leekscript-ts/dist/compiler/Lexer";
import { Parser } from "../../leekscript-ts/dist/compiler/Parser";
import { AIFile, Options } from "./types";
import { ErrorCollector, ErrorType, AnalyzeErrorLevel } from "./ErrorSystem";
import { MainBlock } from "./blocks/MainBlock";
import { Compiler } from "./Compiler";
import { Folder } from "./Folder";

/**
 * Performs first and second pass parsing
 */
export class PassManager {
  private ai: AIFile;
  private version: number;
  private options: Options;
  private mainBlock: MainBlock;
  private compiler: Compiler;
  private lexer: typeof Lexer;
  private tokens: any[] = [];
  private position: number = 0;

  constructor(
    ai: AIFile,
    version: number,
    options: Options,
    mainBlock: MainBlock,
    compiler: Compiler
  ) {
    this.ai = ai;
    this.version = version;
    this.options = options;
    this.mainBlock = mainBlock;
    this.compiler = compiler;
    const LexerClass = Lexer as any;
    this.lexer = new LexerClass(this.ai.code, this.version);
  }

  /**
   * Tokenize the source code
   */
  private tokenize(): void {
    const tokenizeMethod = (this.lexer as any).tokenize;
    this.tokens = tokenizeMethod.call(this.lexer);
    this.position = 0;
  }

  /**
   * Token stream navigation
   */
  private get(): any {
    return this.position < this.tokens.length
      ? this.tokens[this.position]
      : this.tokens[this.tokens.length - 1];
  }

  private eat(): any {
    const token = this.get();
    this.position++;
    return token;
  }

  private skip(): void {
    this.position++;
  }

  private unskip(): void {
    if (this.position > 0) this.position--;
  }

  private hasMore(): boolean {
    return this.position < this.tokens.length && this.get().type !== "EOF";
  }

  private reset(): void {
    this.position = 0;
  }

  /**
   * First Pass: Scan for declarations
   *
   * Discovers:
   * - include statements (recursively processes included files)
   * - global variable declarations
   * - function declarations (names and parameter counts)
   * - class declarations (names only)
   */
  async firstPass(): Promise<void> {
    // Tokenize if needed
    if (this.tokens.length === 0) {
      this.tokenize();
    }

    this.reset();
    const errorCollector = this.compiler.getErrorCollector();

    while (this.hasMore()) {
      // Check timeout
      if (this.compiler.isInterrupted()) {
        throw new Error("AI_TIMEOUT");
      }

      const token = this.get();

      // Handle include statements
      if (token.value === "include") {
        const includeToken = this.eat();

        // Expect (
        if (this.get().type !== "LPAREN") {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: this.get().line,
              startColumn: this.get().column,
              endLine: this.get().line,
              endColumn: this.get().column,
            },
            errorType: ErrorType.OPENING_PARENTHESIS_EXPECTED,
            parameters: [],
          });
          this.skip();
          continue;
        }
        this.skip(); // Skip (

        // Expect string
        if (this.get().type !== "STRING") {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: this.get().line,
              startColumn: this.get().column,
              endLine: this.get().line,
              endColumn: this.get().column,
            },
            errorType: ErrorType.AI_NAME_EXPECTED,
            parameters: [],
          });
          this.skip();
          continue;
        }

        // Extract AI name (remove quotes)
        let aiName = this.eat().value;
        if (aiName.startsWith('"') || aiName.startsWith("'")) {
          aiName = aiName.substring(1, aiName.length - 1);
        }

        // Process include recursively
        const included = await this.mainBlock.includeAIFirstPass(aiName);
        if (!included) {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: includeToken.line,
              startColumn: includeToken.column,
              endLine: this.get().line,
              endColumn: this.get().column,
            },
            errorType: ErrorType.AI_NOT_EXISTING,
            parameters: [aiName],
          });
        }

        // Expect )
        if (this.get().type !== "RPAREN") {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: this.get().line,
              startColumn: this.get().column,
              endLine: this.get().line,
              endColumn: this.get().column,
            },
            errorType: ErrorType.CLOSING_PARENTHESIS_EXPECTED,
            parameters: [],
          });
        } else {
          this.skip();
        }
      }
      // Handle global declarations
      else if (token.type === "GLOBAL") {
        this.skip(); // Skip 'global'

        // Skip optional type annotation
        this.eatType();

        // Get variable name
        const globalToken = this.get();
        if (globalToken.type !== "IDENT") {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: globalToken.line,
              startColumn: globalToken.column,
              endLine: globalToken.line,
              endColumn: globalToken.column,
            },
            errorType: ErrorType.VAR_NAME_EXPECTED,
            parameters: [],
          });
          this.skip();
          continue;
        }

        const globalName = this.eat().value;

        // Check availability and register
        if (this.mainBlock.hasDeclaredGlobal(globalName)) {
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: globalToken.line,
              startColumn: globalToken.column,
              endLine: globalToken.line,
              endColumn: globalToken.column,
            },
            errorType: ErrorType.VARIABLE_NAME_UNAVAILABLE,
            parameters: [],
          });
        } else {
          this.mainBlock.addGlobal(globalName);
        }

        // Skip optional initialization
        if (this.get().type === "ASSIGN") {
          this.skip();
          this.skipExpression();
        }

        // Handle multiple declarations (global x = 1, y = 2)
        while (this.hasMore() && this.get().type === "COMMA") {
          this.skip();

          const nextGlobal = this.get();
          if (nextGlobal.type !== "IDENT") {
            break;
          }

          const nextName = this.eat().value;

          if (this.mainBlock.hasDeclaredGlobal(nextName)) {
            errorCollector.addError({
              level: AnalyzeErrorLevel.ERROR,
              file: this.ai.id,
              location: {
                startLine: nextGlobal.line,
                startColumn: nextGlobal.column,
                endLine: nextGlobal.line,
                endColumn: nextGlobal.column,
              },
              errorType: ErrorType.VARIABLE_NAME_UNAVAILABLE,
              parameters: [],
            });
          } else {
            this.mainBlock.addGlobal(nextName);
          }

          if (this.get().type === "ASSIGN") {
            this.skip();
            this.skipExpression();
          }
        }
      }
      // Handle function declarations
      else if (token.type === "FUNCTION") {
        const functionToken = this.eat();

        // Get function name
        const funcNameToken = this.get();

        // Skip anonymous functions and type declarations
        if (funcNameToken.value === "(" || funcNameToken.value === "<") {
          continue;
        }

        if (funcNameToken.type !== "IDENT") {
          this.skip();
          continue;
        }

        const funcName = this.eat().value;

        // Expect opening parenthesis
        if (this.get().type !== "LPAREN") {
          // Could be a type declaration (Function<T>)
          if (functionToken.value === "Function") {
            this.unskip();
            this.skip();
            continue;
          }
          errorCollector.addError({
            level: AnalyzeErrorLevel.ERROR,
            file: this.ai.id,
            location: {
              startLine: this.get().line,
              startColumn: this.get().column,
              endLine: this.get().line,
              endColumn: this.get().column,
            },
            errorType: ErrorType.OPENING_PARENTHESIS_EXPECTED,
            parameters: [],
          });
          continue;
        }
        this.skip(); // Skip (

        // Count parameters
        let paramCount = 0;
        const parameters: string[] = [];

        while (this.hasMore() && this.get().type !== "RPAREN") {
          // Check timeout
          if (this.compiler.isInterrupted()) {
            throw new Error("AI_TIMEOUT");
          }

          // Skip @ for capture parameters
          if (this.get().value === "@") {
            this.skip();
          }

          // Skip type annotations
          this.eatType();

          // Get parameter name
          const paramToken = this.get();
          if (paramToken.type === "IDENT") {
            const paramName = this.eat().value;
            if (!parameters.includes(paramName)) {
              parameters.push(paramName);
              paramCount++;
            }
          } else {
            this.skip();
          }

          // Skip comma
          if (this.get().type === "COMMA") {
            this.skip();
          }
        }

        // Skip closing parenthesis
        if (this.get().type === "RPAREN") {
          this.skip();
        }

        // Register function declaration with parameter list
        this.mainBlock.addFunctionDeclaration(funcName, paramCount, parameters);
      }
      // Handle class declarations
      else if (token.value === "class") {
        this.skip(); // Skip 'class'

        if (this.hasMore()) {
          const classToken = this.get();

          if (classToken.type === "IDENT") {
            const className = this.eat().value;

            // Check if class already defined
            if (this.mainBlock.getDefinedClass(className)) {
              errorCollector.addError({
                level: AnalyzeErrorLevel.ERROR,
                file: this.ai.id,
                location: {
                  startLine: classToken.line,
                  startColumn: classToken.column,
                  endLine: classToken.line,
                  endColumn: classToken.column,
                },
                errorType: ErrorType.VARIABLE_NAME_UNAVAILABLE,
                parameters: [],
              });
            } else {
              // Register class declaration
              this.mainBlock.defineClass(className);
            }
          }
        }
      }
      // Skip everything else
      else {
        this.skip();
      }
    }
  }

  /**
   * Second Pass: Build full AST
   *
   * Now that all declarations are registered, build the complete AST.
   * Converts the parsed AST from leekscript-ts into our Instruction/Block structure.
   */
  async secondPass(): Promise<void> {
    // Use the standard parser to build AST
    const parser = new (Parser as any)(this.ai.code, this.version);
    const program = parser.parse();

    // Store token stream on AIFile for error location tracking
    const tokenStream: any = {
      tokens: this.tokens,
      position: this.position,
      hasMoreTokens: () => this.hasMore(),
      get: () => this.get(),
      eat: () => this.eat(),
      skip: () => this.skip(),
      reset: () => this.reset(),
      unskip: () => this.unskip(),
    };
    this.ai.setTokenStream(tokenStream);

    // Convert AST statements to instructions (note: leekscript-ts uses 'statements', not 'body')
    if (program && program.statements) {
      this.convertStatementsToInstructions(program.statements, this.mainBlock);
    }
  }

  /**
   * Convert AST statements to our Instruction/Block structure
   */
  private convertStatementsToInstructions(statements: any[], block: any): void {
    // Detect v4 type declarations: "integer x = value" pattern
    // Parser sees this as: [Identifier("integer"), Assignment("x = value")]
    // We need to merge them into a VariableDeclaration
    let i = 0;
    while (i < statements.length) {
      const stmt = statements[i];

      // Check for type identifier followed by assignment
      if (this.isTypeIdentifier(stmt) && i + 1 < statements.length) {
        const nextStmt = statements[i + 1];

        if (this.isAnyAssignment(nextStmt)) {
          // Convert to VariableDeclaration
          this.convertV2VariableDeclaration(stmt, nextStmt, block);
          i += 2; // Skip both statements
          continue;
        }
      }

      this.convertStatement(stmt, block);
      i++;
    }
  }
  /**
   * Check if a statement is a type identifier (integer, string, real, boolean, array, var)
   */
  private isTypeIdentifier(stmt: any): boolean {
    if (stmt?.constructor?.name !== "ExpressionStatement") return false;
    const expr = stmt.expression;
    if (expr?.constructor?.name !== "Identifier") return false;
    const name = expr.name;

    // Check built-in types
    if (
      ["integer", "real", "string", "boolean", "array", "var"].includes(name)
    ) {
      return true;
    }

    // Check user-defined class names (registered in firstPass)
    return this.mainBlock.hasClass(name);
  }

  /**
   * Get identifier name from a statement
   */
  private getIdentifierName(stmt: any): string {
    return stmt?.expression?.name || "";
  }

  /**
   * Check if a statement is any assignment expression
   */
  private isAnyAssignment(stmt: any): boolean {
    if (stmt?.constructor?.name !== "ExpressionStatement") return false;
    const expr = stmt.expression;
    return expr?.constructor?.name === "AssignmentExpression";
  }

  /**
   * Check if a statement is an assignment to a specific variable
   */
  private isAssignment(stmt: any, varName: string): boolean {
    if (!this.isAnyAssignment(stmt)) return false;
    const leftName = stmt.expression.left?.name;
    return leftName === varName;
  }

  /**
   * Convert v2 syntax variable declaration
   * e.g., "integer enemy" + "enemy = getNearestEnemy()" -> var enemy: integer = getNearestEnemy()
   */
  private convertV2VariableDeclaration(
    typeStmt: any,
    assignStmt: any,
    block: any
  ): void {
    const {
      VariableDeclarationInstruction,
    } = require("./instructions/VariableDeclarationInstruction");
    const { Type } = require("./type-system/Type");

    const typeName = typeStmt.expression.name;
    const varName = assignStmt.expression.left.name;
    const value = assignStmt.expression.right;

    // Map type name to Type object
    const typeMap: Record<string, any> = {
      integer: Type.INT,
      real: Type.REAL,
      string: Type.STRING,
      boolean: Type.BOOL,
      array: Type.ARRAY,
      var: Type.ANY,
    };
    const declaredType = typeMap[typeName] || Type.ANY;

    // Get location spanning from type to assignment value
    const typeLocation = this.getLocation(typeStmt);
    const assignLocation = this.getLocation(assignStmt);
    const valueLocation = this.getLocation(value);

    const location = {
      startLine: typeLocation.startLine,
      startColumn: typeLocation.startColumn,
      endLine: valueLocation.endLine || assignLocation.endLine,
      endColumn: valueLocation.endColumn || assignLocation.endColumn,
    };
    const line = location.startLine;

    // For error reporting, we'll attach the assignment expression location
    // which points to the `=` operator
    // Note: Adding 1 to column to match Java generator's 1-based indexing
    (value as any).__assignLocation = assignStmt.expression?.token
      ? {
          startLine: assignStmt.expression.token.line,
          startColumn: assignStmt.expression.token.column + 1,
          endLine: assignStmt.expression.token.line,
          endColumn: assignStmt.expression.token.column + 2,
        }
      : assignLocation;

    const instruction = new VariableDeclarationInstruction(
      varName,
      value,
      declaredType, // declared type as Type object
      line,
      location,
      "var" // keyword
    );
    block.addInstruction(instruction);
  }

  /**
   * Convert a single AST statement to an instruction
   */
  private convertStatement(stmt: any, block: any): void {
    // leekscript-ts uses constructor names, not a 'type' property
    const stmtType = stmt?.constructor?.name;
    if (!stmt || !stmtType) return;

    const {
      VariableDeclarationInstruction,
    } = require("./instructions/VariableDeclarationInstruction");
    const { ReturnInstruction } = require("./instructions/ReturnInstruction");
    const {
      ExpressionInstruction,
    } = require("./instructions/ExpressionInstruction");
    const {
      GlobalDeclarationInstruction,
    } = require("./instructions/GlobalDeclarationInstruction");
    const {
      BreakInstruction,
      ContinueInstruction,
    } = require("./instructions/ControlFlowInstructions");
    const {
      IfBlock,
      WhileBlock,
      ForBlock,
      DoWhileBlock,
    } = require("./blocks/ControlFlowBlocks");
    const { FunctionBlock } = require("./blocks/FunctionBlock");

    const location = this.getLocation(stmt);
    const line = location.startLine;

    switch (stmtType) {
      case "VariableDeclaration":
        // var x = 5; or let x: int = 5;
        for (const declarator of stmt.declarations) {
          const name = declarator.id.name;
          const value = declarator.init;
          const declaredType = declarator.id.typeAnnotation?.typeAnnotation;
          const instruction = new VariableDeclarationInstruction(
            name,
            value,
            declaredType,
            stmt.kind, // 'var', 'let', 'const'
            line,
            location
          );
          block.addInstruction(instruction);
        }
        break;

      case "ReturnStatement":
        const returnInst = new ReturnInstruction(
          stmt.argument,
          line,
          location,
          false // optional return (return?)
        );
        block.addInstruction(returnInst);
        break;

      case "ExpressionStatement":
        const exprInst = new ExpressionInstruction(
          stmt.expression,
          line,
          location
        );
        block.addInstruction(exprInst);
        break;

      case "GlobalDeclaration":
        // global x = 5;
        const globalInst = new GlobalDeclarationInstruction(
          stmt.id.name,
          stmt.init,
          stmt.id.typeAnnotation?.typeAnnotation,
          line,
          location
        );
        block.addInstruction(globalInst);
        break;

      case "IfStatement":
        // if (condition) { ... } else { ... }
        const ifBlock = new IfBlock(
          stmt.test, // condition expression
          line,
          true // hasAccolade
        );

        // Convert consequent (then block)
        if (stmt.consequent) {
          if (stmt.consequent.type === "BlockStatement") {
            this.convertStatementsToInstructions(stmt.consequent.body, ifBlock);
          } else {
            this.convertStatement(stmt.consequent, ifBlock);
          }
        }

        // Handle else block
        if (stmt.alternate) {
          const elseBlock = new IfBlock(null, line, true);
          if (stmt.alternate.type === "BlockStatement") {
            this.convertStatementsToInstructions(
              stmt.alternate.body,
              elseBlock
            );
          } else if (stmt.alternate.type === "IfStatement") {
            // else if - convert as nested if
            this.convertStatement(stmt.alternate, elseBlock);
          } else {
            this.convertStatement(stmt.alternate, elseBlock);
          }
          ifBlock.setElseBlock(elseBlock);
        }

        block.addInstruction(ifBlock);
        break;

      case "WhileStatement":
        const whileBlock = new WhileBlock(
          stmt.test, // condition
          line,
          true
        );

        if (stmt.body) {
          if (stmt.body.type === "BlockStatement") {
            this.convertStatementsToInstructions(stmt.body.body, whileBlock);
          } else {
            this.convertStatement(stmt.body, whileBlock);
          }
        }

        block.addInstruction(whileBlock);
        break;

      case "DoWhileStatement":
        const doWhileBlock = new DoWhileBlock(
          stmt.test, // condition
          line,
          true
        );

        if (stmt.body) {
          if (stmt.body.type === "BlockStatement") {
            this.convertStatementsToInstructions(stmt.body.body, doWhileBlock);
          } else {
            this.convertStatement(stmt.body, doWhileBlock);
          }
        }

        block.addInstruction(doWhileBlock);
        break;

      case "ForStatement":
        // for (init; test; update) { ... }
        const forBlock = new ForBlock(
          stmt.init, // init (can be expression or variable declaration)
          stmt.test, // condition
          stmt.update, // increment
          line,
          true
        );

        if (stmt.body) {
          if (stmt.body.type === "BlockStatement") {
            this.convertStatementsToInstructions(stmt.body.body, forBlock);
          } else {
            this.convertStatement(stmt.body, forBlock);
          }
        }

        block.addInstruction(forBlock);
        break;

      case "BreakStatement":
        block.addInstruction(new BreakInstruction(line, location));
        break;

      case "ContinueStatement":
        block.addInstruction(new ContinueInstruction(line, location));
        break;

      case "FunctionDeclaration":
        // Functions are handled in firstPass, but we need to populate the body
        const funcName = stmt.id.name;
        const funcInfo = this.compiler
          .getSymbolTable()
          .getFunctions()
          .get(funcName);
        if (funcInfo && funcInfo.block) {
          // Convert function body
          if (stmt.body && stmt.body.type === "BlockStatement") {
            this.convertStatementsToInstructions(
              stmt.body.body,
              funcInfo.block
            );
          }
        }
        break;

      case "ClassDeclaration":
        // Register class in symbol table
        if (stmt.name) {
          const className = (stmt.name as any).name || stmt.name;
          this.mainBlock.defineClass(className);
        }

        // Process class body if present (for constructors, fields, methods)
        if (stmt.body && Array.isArray(stmt.body)) {
          // For now, we skip processing class members
          // Full class implementation would require handling constructors, fields, and methods
        }
        break;

      case "BlockStatement":
        // Block statements contain other statements
        // Process the statements inside the block
        if (stmt.body && Array.isArray(stmt.body)) {
          this.convertStatementsToInstructions(stmt.body, block);
        }
        break;

      default:
        // Unknown statement type - log warning
        console.warn(
          `Unknown statement type in secondPass: ${stmtType} (constructor: ${stmt?.constructor?.name})`
        );
        break;
    }
  }

  /**
   * Extract location from AST node
   */
  private getLocation(node: any): any {
    // leekscript-ts uses `token` property with line/column
    if (node && node.token) {
      return {
        startLine: node.token.line,
        startColumn: node.token.column,
        endLine: node.token.line, // TODO: Get end position
        endColumn: node.token.column + (node.token.value?.length || 0),
      };
    }
    // Fallback to standard loc property
    if (node && node.loc) {
      return {
        startLine: node.loc.start.line,
        startColumn: node.loc.start.column,
        endLine: node.loc.end.line,
        endColumn: node.loc.end.column,
      };
    }
    return {
      startLine: 0,
      startColumn: 0,
      endLine: 0,
      endColumn: 0,
    };
  }

  /**
   * Skip type annotation (e.g., "int", "string", "array<int>")
   */
  private eatType(): void {
    if (!this.hasMore()) return;

    // Simple types are identifiers
    if (this.get().type === "IDENT") {
      this.skip();

      // Handle generic types (array<int>, map<string, int>)
      if (this.get().value === "<") {
        let depth = 1;
        this.skip();

        while (this.hasMore() && depth > 0) {
          if (this.get().value === "<") depth++;
          if (this.get().value === ">") depth--;
          this.skip();
        }
      }
    }
  }

  /**
   * Skip an expression (don't parse it, just skip tokens)
   */
  private skipExpression(): void {
    let depth = 0;

    while (this.hasMore()) {
      const token = this.get();

      // Track parenthesis/bracket/brace depth
      if (
        token.type === "LPAREN" ||
        token.type === "LBRACKET" ||
        token.type === "LBRACE"
      ) {
        depth++;
      } else if (
        token.type === "RPAREN" ||
        token.type === "RBRACKET" ||
        token.type === "RBRACE"
      ) {
        if (depth === 0) break;
        depth--;
      }
      // Stop at statement terminators
      else if (
        depth === 0 &&
        (token.type === "SEMICOLON" || token.type === "COMMA")
      ) {
        break;
      }

      this.skip();
    }
  }
}
