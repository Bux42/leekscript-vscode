import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { Lexer } from "./Lexer";
import {
  Program,
  Statement,
  Expression,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  ArrayLiteral,
  Identifier,
  BinaryExpression,
  UnaryExpression,
  AssignmentExpression,
  CallExpression,
  MemberExpression,
  ArrayAccessExpression,
  TernaryExpression,
  FunctionExpression,
  VariableDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
} from "./ast";

/**
 * Recursive descent parser for LeekScript
 * Converts token stream into Abstract Syntax Tree
 */
export class Parser {
  private tokens: Token[] = [];
  private current = 0;

  constructor(private source: string, private version = 4) {}

  /**
   * Parse source code and return AST
   */
  parse(): Program {
    // Tokenize first
    const lexer = new Lexer(this.source, this.version);
    this.tokens = lexer.tokenize();
    this.current = 0;

    // Parse statements
    const statements: Statement[] = [];
    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    const token = this.tokens[0] || new Token(TokenType.EOF, "", 1, 1, 0);
    return new Program(token, statements);
  }

  // ===== STATEMENTS =====

  private parseStatement(): Statement | null {
    // Skip semicolons
    if (this.match(TokenType.SEMICOLON)) {
      return null;
    }

    // Variable declarations
    if (
      this.check(TokenType.VAR) ||
      this.check(TokenType.LET) ||
      this.check(TokenType.CONST) ||
      this.check(TokenType.GLOBAL)
    ) {
      return this.parseVariableDeclaration();
    }

    // Function declaration
    if (this.check(TokenType.FUNCTION)) {
      return this.parseFunctionDeclaration();
    }

    // Class declaration
    if (this.check(TokenType.CLASS)) {
      return this.parseClassDeclaration();
    }

    // Return statement
    if (this.check(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }

    // If statement
    if (this.check(TokenType.IF)) {
      return this.parseIfStatement();
    }

    // While statement
    if (this.check(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }

    // Do-while statement
    if (this.check(TokenType.DO)) {
      return this.parseDoWhileStatement();
    }

    // For statement
    if (this.check(TokenType.FOR)) {
      return this.parseForStatement();
    }

    // Break statement
    if (this.check(TokenType.BREAK)) {
      const token = this.advance();
      this.consumeOptional(TokenType.SEMICOLON);
      return new BreakStatement(token);
    }

    // Continue statement
    if (this.check(TokenType.CONTINUE)) {
      const token = this.advance();
      this.consumeOptional(TokenType.SEMICOLON);
      return new ContinueStatement(token);
    }

    // Block statement
    if (this.check(TokenType.LBRACE)) {
      return this.parseBlockStatement();
    }

    // Expression statement
    return this.parseExpressionStatement();
  }

  private parseVariableDeclaration(): Statement {
    const token = this.advance(); // var, let, const, or global
    const kind = token.value as "var" | "let" | "const" | "global";

    const declarations: VariableDeclaration[] = [];

    // Parse first variable
    const firstName = this.consume(
      TokenType.IDENT,
      `Expected variable name after ${kind}`
    );
    const firstIdentifier = new Identifier(firstName, firstName.value);
    let firstInit: Expression | undefined;
    if (this.match(TokenType.ASSIGN)) {
      firstInit = this.parseExpression();
    }
    declarations.push(
      new VariableDeclaration(token, kind, firstIdentifier, firstInit)
    );

    // Parse additional variables if comma-separated
    while (this.match(TokenType.COMMA)) {
      const name = this.consume(TokenType.IDENT, `Expected variable name`);
      const identifier = new Identifier(name, name.value);
      let init: Expression | undefined;
      if (this.match(TokenType.ASSIGN)) {
        init = this.parseExpression();
      }
      declarations.push(new VariableDeclaration(token, kind, identifier, init));
    }

    this.consumeOptional(TokenType.SEMICOLON);

    // If only one declaration, return it directly
    if (declarations.length === 1) {
      return declarations[0];
    }

    // Otherwise, wrap in a BlockStatement to group them
    return new BlockStatement(token, declarations);
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const token = this.consume(TokenType.FUNCTION, "Expected function keyword");
    const name = this.consume(TokenType.IDENT, "Expected function name");
    const identifier = new Identifier(name, name.value);

    this.consume(TokenType.LPAREN, "Expected ( after function name");

    const params: Identifier[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const param = this.consume(TokenType.IDENT, "Expected parameter name");
        params.push(new Identifier(param, param.value));
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ) after parameters");

    const body = this.parseBlockStatement();
    return new FunctionDeclaration(token, identifier, params, body);
  }

  private parseFunctionExpression(): FunctionExpression {
    const token = this.previous(); // function keyword already consumed

    this.consume(TokenType.LPAREN, "Expected ( after function keyword");

    const params: Identifier[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const param = this.consume(TokenType.IDENT, "Expected parameter name");
        params.push(new Identifier(param, param.value));
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ) after parameters");

    const body = this.parseBlockStatement();
    return new FunctionExpression(token, params, body);
  }

  private parseClassDeclaration(): ClassDeclaration {
    const token = this.consume(TokenType.CLASS, "Expected class keyword");
    const name = this.consume(TokenType.IDENT, "Expected class name");
    const identifier = new Identifier(name, name.value);

    let superClass: Identifier | null = null;
    if (this.match(TokenType.EXTENDS)) {
      const superName = this.consume(
        TokenType.IDENT,
        "Expected superclass name after extends"
      );
      superClass = new Identifier(superName, superName.value);
    }

    this.consume(TokenType.LBRACE, "Expected { before class body");

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      }
    }

    this.consume(TokenType.RBRACE, "Expected } after class body");
    return new ClassDeclaration(token, identifier, superClass, body);
  }

  private parseReturnStatement(): ReturnStatement {
    const token = this.consume(TokenType.RETURN, "Expected return keyword");

    let argument: Expression | undefined;
    if (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      argument = this.parseExpression();
    }

    this.consumeOptional(TokenType.SEMICOLON);
    return new ReturnStatement(token, argument);
  }

  private parseIfStatement(): IfStatement {
    const token = this.consume(TokenType.IF, "Expected if keyword");
    this.consume(TokenType.LPAREN, "Expected ( after if");
    const condition = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ) after condition");

    const consequent = this.parseStatement()!;

    let alternate: Statement | undefined;
    if (this.match(TokenType.ELSE)) {
      alternate = this.parseStatement()!;
    }

    return new IfStatement(token, condition, consequent, alternate);
  }

  private parseWhileStatement(): WhileStatement {
    const token = this.consume(TokenType.WHILE, "Expected while keyword");
    this.consume(TokenType.LPAREN, "Expected ( after while");
    const condition = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ) after condition");

    const body = this.parseStatement()!;
    return new WhileStatement(token, condition, body);
  }

  private parseDoWhileStatement(): WhileStatement {
    const token = this.consume(TokenType.DO, "Expected do keyword");
    const body = this.parseStatement()!;

    this.consume(TokenType.WHILE, "Expected while after do body");
    this.consume(TokenType.LPAREN, "Expected ( after while");
    const condition = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ) after condition");
    this.consumeOptional(TokenType.SEMICOLON);

    return new WhileStatement(token, condition, body);
  }

  private parseForStatement(): ForStatement {
    const token = this.consume(TokenType.FOR, "Expected for keyword");
    this.consume(TokenType.LPAREN, "Expected ( after for");

    // Init
    let init: VariableDeclaration | Expression | null = null;
    if (this.match(TokenType.SEMICOLON)) {
      init = null;
    } else if (this.check(TokenType.VAR) || this.check(TokenType.LET)) {
      init = this.parseVariableDeclaration();
      // Variable declaration already consumes semicolon
    } else {
      init = this.parseExpression();
      this.consume(TokenType.SEMICOLON, "Expected ; after for init");
    }

    // Condition
    let condition: Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.parseExpression();
    }
    this.consume(TokenType.SEMICOLON, "Expected ; after for condition");

    // Update
    let update: Expression | null = null;
    if (!this.check(TokenType.RPAREN)) {
      update = this.parseExpression();
    }
    this.consume(TokenType.RPAREN, "Expected ) after for clauses");

    const body = this.parseStatement()!;
    return new ForStatement(token, init, condition, update, body);
  }

  private parseBlockStatement(): BlockStatement {
    const token = this.consume(TokenType.LBRACE, "Expected {");

    const statements: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    this.consume(TokenType.RBRACE, "Expected }");
    return new BlockStatement(token, statements);
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expr = this.parseExpression();
    this.consumeOptional(TokenType.SEMICOLON);
    return new ExpressionStatement(expr.token, expr);
  }

  // ===== EXPRESSIONS =====

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expr = this.parseTernary();

    // Assignment operators
    if (
      this.check(TokenType.ASSIGN) ||
      this.check(TokenType.PLUS_ASSIGN) ||
      this.check(TokenType.MINUS_ASSIGN) ||
      this.check(TokenType.TIMES_ASSIGN) ||
      this.check(TokenType.DIVIDE_ASSIGN) ||
      this.check(TokenType.MODULO_ASSIGN) ||
      this.check(TokenType.POWER_ASSIGN)
    ) {
      const operator = this.advance();
      const right = this.parseAssignment();
      return new AssignmentExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parseTernary(): Expression {
    let expr = this.parseLogicalOr();

    if (this.match(TokenType.QUESTION)) {
      const questionToken = this.previous();
      const consequent = this.parseExpression();
      this.consume(TokenType.COLON, "Expected : in ternary expression");
      const alternate = this.parseExpression();
      expr = new TernaryExpression(questionToken, expr, consequent, alternate);
    }

    return expr;
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();

    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.parseLogicalAnd();
      expr = new BinaryExpression(operator, expr, "||", right);
    }

    return expr;
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseBitwiseOr();

    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.parseBitwiseOr();
      expr = new BinaryExpression(operator, expr, "&&", right);
    }

    return expr;
  }

  private parseBitwiseOr(): Expression {
    let expr = this.parseBitwiseXor();

    while (this.match(TokenType.BIT_OR)) {
      const operator = this.previous();
      const right = this.parseBitwiseXor();
      expr = new BinaryExpression(operator, expr, "|", right);
    }

    return expr;
  }

  private parseBitwiseXor(): Expression {
    let expr = this.parseBitwiseAnd();

    while (this.match(TokenType.BIT_XOR)) {
      const operator = this.previous();
      const right = this.parseBitwiseAnd();
      expr = new BinaryExpression(operator, expr, "^", right);
    }

    return expr;
  }

  private parseBitwiseAnd(): Expression {
    let expr = this.parseEquality();

    while (this.match(TokenType.BIT_AND)) {
      const operator = this.previous();
      const right = this.parseEquality();
      expr = new BinaryExpression(operator, expr, "&", right);
    }

    return expr;
  }

  private parseEquality(): Expression {
    let expr = this.parseComparison();

    while (this.match(TokenType.EQUALS, TokenType.NOT_EQUALS)) {
      const operator = this.previous();
      const right = this.parseComparison();
      expr = new BinaryExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parseComparison(): Expression {
    let expr = this.parseBitShift();

    while (
      this.match(
        TokenType.LESS,
        TokenType.LESS_EQUALS,
        TokenType.GREATER,
        TokenType.GREATER_EQUALS
      )
    ) {
      const operator = this.previous();
      const right = this.parseBitShift();
      expr = new BinaryExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parseBitShift(): Expression {
    let expr = this.parseAddition();

    while (
      this.match(
        TokenType.BIT_SHIFT_LEFT,
        TokenType.BIT_SHIFT_RIGHT,
        TokenType.BIT_SHIFT_RIGHT_UNSIGNED
      )
    ) {
      const operator = this.previous();
      const right = this.parseAddition();
      expr = new BinaryExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parseAddition(): Expression {
    let expr = this.parseMultiplication();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.parseMultiplication();
      expr = new BinaryExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parseMultiplication(): Expression {
    let expr = this.parsePower();

    while (this.match(TokenType.TIMES, TokenType.DIVIDE, TokenType.MODULO)) {
      const operator = this.previous();
      const right = this.parsePower();
      expr = new BinaryExpression(operator, expr, operator.value, right);
    }

    return expr;
  }

  private parsePower(): Expression {
    let expr = this.parseUnary();

    if (this.match(TokenType.POWER)) {
      const operator = this.previous();
      const right = this.parsePower(); // Right associative
      expr = new BinaryExpression(operator, expr, "**", right);
    }

    return expr;
  }

  private parseUnary(): Expression {
    // Prefix operators
    if (
      this.match(
        TokenType.NOT,
        TokenType.MINUS,
        TokenType.PLUS,
        TokenType.BIT_NOT,
        TokenType.INCREMENT,
        TokenType.DECREMENT
      )
    ) {
      const operator = this.previous();
      const operand = this.parseUnary();
      return new UnaryExpression(operator, operator.value, operand, true);
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parseCall();

    // Postfix increment/decrement
    if (this.match(TokenType.INCREMENT, TokenType.DECREMENT)) {
      const operator = this.previous();
      expr = new UnaryExpression(operator, operator.value, expr, false);
    }

    return expr;
  }

  private parseCall(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.parseExpression();
        const closeBracket = this.consume(
          TokenType.RBRACKET,
          "Expected ] after array index"
        );
        expr = new ArrayAccessExpression(closeBracket, expr, index);
      } else if (this.match(TokenType.DOT)) {
        const property = this.consume(
          TokenType.IDENT,
          "Expected property name after ."
        );
        const identifier = new Identifier(property, property.value);
        expr = new MemberExpression(property, expr, identifier, false);
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    const args: Expression[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    const paren = this.consume(TokenType.RPAREN, "Expected ) after arguments");
    return new CallExpression(paren, callee, args);
  }

  private parsePrimary(): Expression {
    // Literals
    if (this.match(TokenType.TRUE)) {
      return new BooleanLiteral(this.previous(), true);
    }
    if (this.match(TokenType.FALSE)) {
      return new BooleanLiteral(this.previous(), false);
    }
    if (this.match(TokenType.NULL)) {
      return new NullLiteral(this.previous());
    }

    // Number
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      const value = this.parseNumber(token.value);
      return new NumberLiteral(token, value, token.value);
    }

    // String
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      const value = this.parseString(token.value);
      return new StringLiteral(token, value, token.value);
    }

    // Identifier
    if (this.match(TokenType.IDENT)) {
      const token = this.previous();
      return new Identifier(token, token.value);
    }

    // Array literal
    if (this.match(TokenType.LBRACKET)) {
      return this.parseArrayLiteral();
    }

    // Function expression
    if (this.match(TokenType.FUNCTION)) {
      return this.parseFunctionExpression();
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ) after expression");
      return expr;
    }

    throw new Error(
      `Unexpected token: ${this.peek().value} at ${this.peek().line}:${
        this.peek().column
      }`
    );
  }

  private parseArrayLiteral(): ArrayLiteral {
    const token = this.previous(); // [
    const elements: Expression[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      do {
        // Allow trailing comma
        if (this.check(TokenType.RBRACKET)) break;
        elements.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RBRACKET, "Expected ] after array elements");
    return new ArrayLiteral(token, elements);
  }

  private parseNumber(value: string): number {
    // Handle special values
    if (value === "∞") return Infinity;
    if (value === "π") return Math.PI;

    // Parse number
    return parseFloat(value);
  }

  private parseString(value: string): string {
    // Remove quotes and handle escape sequences
    if (value.length < 2) return "";

    const quote = value[0];
    let result = "";
    let i = 1;

    while (i < value.length - 1) {
      if (value[i] === "\\" && i + 1 < value.length - 1) {
        const next = value[i + 1];
        if (next === "n") {
          result += "\n";
          i += 2;
        } else if (next === "t") {
          result += "\t";
          i += 2;
        } else if (next === "r") {
          result += "\r";
          i += 2;
        } else if (next === "\\") {
          result += "\\";
          i += 2;
        } else if (next === quote) {
          result += quote;
          i += 2;
        } else {
          result += value[i];
          i++;
        }
      } else {
        result += value[i];
        i++;
      }
    }

    return result;
  }

  // ===== HELPER METHODS =====

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const token = this.peek();
    throw new Error(
      `${message} at ${token.line}:${token.column}, got '${token.value}'`
    );
  }

  private consumeOptional(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }
}
