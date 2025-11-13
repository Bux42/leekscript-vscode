import { Token } from "../Token";

/**
 * Base class for all AST nodes
 * Represents a node in the Abstract Syntax Tree
 */
export abstract class ASTNode {
  constructor(public token: Token) {}

  /**
   * Get the location of this node in source code
   */
  getLocation(): { line: number; column: number } {
    return {
      line: this.token.line,
      column: this.token.column,
    };
  }

  /**
   * Accept a visitor for traversing the AST
   */
  abstract accept<T>(visitor: ASTVisitor<T>): T;

  /**
   * Get a string representation for debugging
   */
  abstract toString(): string;
}

/**
 * Visitor pattern interface for AST traversal
 */
export interface ASTVisitor<T> {
  // Literals
  visitNumberLiteral(node: NumberLiteral): T;
  visitStringLiteral(node: StringLiteral): T;
  visitBooleanLiteral(node: BooleanLiteral): T;
  visitNullLiteral(node: NullLiteral): T;
  visitArrayLiteral(node: ArrayLiteral): T;

  // Expressions
  visitIdentifier(node: Identifier): T;
  visitBinaryExpression(node: BinaryExpression): T;
  visitUnaryExpression(node: UnaryExpression): T;
  visitAssignmentExpression(node: AssignmentExpression): T;
  visitCallExpression(node: CallExpression): T;
  visitMemberExpression(node: MemberExpression): T;
  visitArrayAccessExpression(node: ArrayAccessExpression): T;
  visitTernaryExpression(node: TernaryExpression): T;
  visitFunctionExpression(node: FunctionExpression): T;

  // Statements
  visitVariableDeclaration(node: VariableDeclaration): T;
  visitFunctionDeclaration(node: FunctionDeclaration): T;
  visitClassDeclaration(node: ClassDeclaration): T;
  visitReturnStatement(node: ReturnStatement): T;
  visitIfStatement(node: IfStatement): T;
  visitWhileStatement(node: WhileStatement): T;
  visitForStatement(node: ForStatement): T;
  visitBreakStatement(node: BreakStatement): T;
  visitContinueStatement(node: ContinueStatement): T;
  visitExpressionStatement(node: ExpressionStatement): T;
  visitBlockStatement(node: BlockStatement): T;

  // Program
  visitProgram(node: Program): T;
}

// ===== EXPRESSIONS =====

/**
 * Base class for all expression nodes
 */
export abstract class Expression extends ASTNode {}

/**
 * Number literal (42, 3.14, 1e10, etc.)
 */
export class NumberLiteral extends Expression {
  constructor(token: Token, public value: number, public raw: string) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitNumberLiteral(this);
  }

  toString(): string {
    return `NumberLiteral(${this.value})`;
  }
}

/**
 * String literal ("hello", 'world', etc.)
 */
export class StringLiteral extends Expression {
  constructor(token: Token, public value: string, public raw: string) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitStringLiteral(this);
  }

  toString(): string {
    return `StringLiteral("${this.value}")`;
  }
}

/**
 * Boolean literal (true, false)
 */
export class BooleanLiteral extends Expression {
  constructor(token: Token, public value: boolean) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitBooleanLiteral(this);
  }

  toString(): string {
    return `BooleanLiteral(${this.value})`;
  }
}

/**
 * Null literal
 */
export class NullLiteral extends Expression {
  constructor(token: Token) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitNullLiteral(this);
  }

  toString(): string {
    return "NullLiteral";
  }
}

/**
 * Array literal ([1, 2, 3])
 */
export class ArrayLiteral extends Expression {
  constructor(token: Token, public elements: Expression[]) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitArrayLiteral(this);
  }

  toString(): string {
    return `ArrayLiteral[${this.elements.length}]`;
  }
}

/**
 * Identifier (variable name, function name, etc.)
 */
export class Identifier extends Expression {
  constructor(token: Token, public name: string) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitIdentifier(this);
  }

  toString(): string {
    return `Identifier(${this.name})`;
  }
}

/**
 * Binary expression (a + b, x * y, etc.)
 */
export class BinaryExpression extends Expression {
  constructor(
    token: Token,
    public left: Expression,
    public operator: string,
    public right: Expression
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitBinaryExpression(this);
  }

  toString(): string {
    return `BinaryExpression(${this.operator})`;
  }
}

/**
 * Unary expression (!x, -y, ++z, etc.)
 */
export class UnaryExpression extends Expression {
  constructor(
    token: Token,
    public operator: string,
    public operand: Expression,
    public prefix: boolean
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitUnaryExpression(this);
  }

  toString(): string {
    return `UnaryExpression(${this.operator}, prefix=${this.prefix})`;
  }
}

/**
 * Assignment expression (x = 5, y += 2, etc.)
 */
export class AssignmentExpression extends Expression {
  constructor(
    token: Token,
    public left: Expression,
    public operator: string,
    public right: Expression
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitAssignmentExpression(this);
  }

  toString(): string {
    return `AssignmentExpression(${this.operator})`;
  }
}

/**
 * Function call expression (func(a, b))
 */
export class CallExpression extends Expression {
  constructor(
    token: Token,
    public callee: Expression,
    public args: Expression[]
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitCallExpression(this);
  }

  toString(): string {
    return `CallExpression(${this.args.length} args)`;
  }
}

/**
 * Member access expression (obj.property)
 */
export class MemberExpression extends Expression {
  constructor(
    token: Token,
    public object: Expression,
    public property: Identifier,
    public computed: boolean = false
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitMemberExpression(this);
  }

  toString(): string {
    return `MemberExpression(${this.computed ? "computed" : "dot"})`;
  }
}

/**
 * Array access expression (arr[index])
 */
export class ArrayAccessExpression extends Expression {
  constructor(
    token: Token,
    public array: Expression,
    public index: Expression
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitArrayAccessExpression(this);
  }

  toString(): string {
    return "ArrayAccessExpression";
  }
}

/**
 * Ternary expression (condition ? consequent : alternate)
 */
export class TernaryExpression extends Expression {
  constructor(
    token: Token,
    public condition: Expression,
    public consequent: Expression,
    public alternate: Expression
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitTernaryExpression(this);
  }

  toString(): string {
    return "TernaryExpression";
  }
}

/**
 * Function expression (function(x, y) { ... })
 */
export class FunctionExpression extends Expression {
  constructor(
    token: Token,
    public params: Identifier[],
    public body: Statement
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitFunctionExpression(this);
  }

  toString(): string {
    return "FunctionExpression";
  }
}

// ===== STATEMENTS =====

/**
 * Base class for all statement nodes
 */
export abstract class Statement extends ASTNode {}

/**
 * Variable declaration (var x = 5, let y, etc.)
 */
export class VariableDeclaration extends Statement {
  constructor(
    token: Token,
    public kind: "var" | "let" | "const" | "global",
    public name: Identifier,
    public init?: Expression
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitVariableDeclaration(this);
  }

  toString(): string {
    return `VariableDeclaration(${this.kind} ${this.name.name})`;
  }
}

/**
 * Function declaration
 */
export class FunctionDeclaration extends Statement {
  constructor(
    token: Token,
    public name: Identifier,
    public params: Identifier[],
    public body: BlockStatement
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitFunctionDeclaration(this);
  }

  toString(): string {
    return `FunctionDeclaration(${this.name.name}, ${this.params.length} params)`;
  }
}

/**
 * Class declaration
 */
export class ClassDeclaration extends Statement {
  constructor(
    token: Token,
    public name: Identifier,
    public superClass: Identifier | null,
    public body: Statement[]
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitClassDeclaration(this);
  }

  toString(): string {
    return `ClassDeclaration(${this.name.name})`;
  }
}

/**
 * Return statement
 */
export class ReturnStatement extends Statement {
  constructor(token: Token, public argument?: Expression) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitReturnStatement(this);
  }

  toString(): string {
    return "ReturnStatement";
  }
}

/**
 * If statement
 */
export class IfStatement extends Statement {
  constructor(
    token: Token,
    public condition: Expression,
    public consequent: Statement,
    public alternate?: Statement
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitIfStatement(this);
  }

  toString(): string {
    return "IfStatement";
  }
}

/**
 * While statement
 */
export class WhileStatement extends Statement {
  constructor(
    token: Token,
    public condition: Expression,
    public body: Statement
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitWhileStatement(this);
  }

  toString(): string {
    return "WhileStatement";
  }
}

/**
 * For statement
 */
export class ForStatement extends Statement {
  constructor(
    token: Token,
    public init: Statement | Expression | null,
    public condition: Expression | null,
    public update: Expression | null,
    public body: Statement
  ) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitForStatement(this);
  }

  toString(): string {
    return "ForStatement";
  }
}

/**
 * Break statement
 */
export class BreakStatement extends Statement {
  constructor(token: Token) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitBreakStatement(this);
  }

  toString(): string {
    return "BreakStatement";
  }
}

/**
 * Continue statement
 */
export class ContinueStatement extends Statement {
  constructor(token: Token) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitContinueStatement(this);
  }

  toString(): string {
    return "ContinueStatement";
  }
}

/**
 * Expression statement (standalone expression)
 */
export class ExpressionStatement extends Statement {
  constructor(token: Token, public expression: Expression) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitExpressionStatement(this);
  }

  toString(): string {
    return `ExpressionStatement(${this.expression.toString()})`;
  }
}

/**
 * Block statement (group of statements in braces)
 */
export class BlockStatement extends Statement {
  constructor(token: Token, public statements: Statement[]) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitBlockStatement(this);
  }

  toString(): string {
    return `BlockStatement(${this.statements.length} statements)`;
  }
}

// ===== PROGRAM =====

/**
 * Root node of the AST - represents the entire program
 */
export class Program extends ASTNode {
  constructor(token: Token, public statements: Statement[]) {
    super(token);
  }

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitProgram(this);
  }

  toString(): string {
    return `Program(${this.statements.length} statements)`;
  }
}
