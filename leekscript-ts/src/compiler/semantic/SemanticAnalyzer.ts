/**
 * Semantic Analyzer for LeekScript
 * Performs type checking, variable resolution, and semantic validation
 */

import {
  ASTNode,
  Program,
  Expression,
  Statement,
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
  ASTVisitor,
} from "../ast/Node";
import { SymbolTable, SymbolKind } from "./SymbolTable";
import { Type, Types, CastType, FunctionType } from "../types/Type";

export enum ErrorLevel {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

export interface SemanticError {
  level: ErrorLevel;
  message: string;
  line: number;
  column: number;
  node?: ASTNode;
}

export interface AnalysisResult {
  success: boolean;
  errors: SemanticError[];
  warnings: SemanticError[];
  symbolTable: SymbolTable;
}

/**
 * Semantic Analyzer visitor
 */
export class SemanticAnalyzer implements ASTVisitor<Type> {
  private symbolTable: SymbolTable;
  private errors: SemanticError[] = [];
  private warnings: SemanticError[] = [];
  private currentFunctionReturnType: Type | null = null;
  private inLoop: number = 0; // Depth counter for nested loops

  constructor() {
    this.symbolTable = new SymbolTable();
  }

  /**
   * Analyze a program and return the analysis result
   */
  analyze(program: Program): AnalysisResult {
    this.errors = [];
    this.warnings = [];
    this.symbolTable.reset();

    try {
      program.accept(this);
    } catch (error) {
      if (error instanceof Error) {
        this.addError(`Internal error: ${error.message}`, 0, 0);
      }
    }

    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      symbolTable: this.symbolTable,
    };
  }

  /**
   * Add an error
   */
  private addError(
    message: string,
    line: number,
    column: number,
    node?: ASTNode
  ): void {
    this.errors.push({
      level: ErrorLevel.ERROR,
      message,
      line,
      column,
      node,
    });
  }

  /**
   * Add a warning
   */
  private addWarning(
    message: string,
    line: number,
    column: number,
    node?: ASTNode
  ): void {
    this.warnings.push({
      level: ErrorLevel.WARNING,
      message,
      line,
      column,
      node,
    });
  }

  // ========== Visitor Methods ==========

  visitProgram(node: Program): Type {
    for (const statement of node.statements) {
      statement.accept(this);
    }
    return Types.VOID;
  }

  // ========== Literals ==========

  visitNumberLiteral(node: NumberLiteral): Type {
    // Check if it's an integer or real
    if (Number.isInteger(node.value)) {
      return Types.INT;
    }
    return Types.REAL;
  }

  visitStringLiteral(node: StringLiteral): Type {
    return Types.STRING;
  }

  visitBooleanLiteral(node: BooleanLiteral): Type {
    return Types.BOOL;
  }

  visitNullLiteral(node: NullLiteral): Type {
    return Types.NULL;
  }

  visitArrayLiteral(node: ArrayLiteral): Type {
    if (node.elements.length === 0) {
      return Types.EMPTY_ARRAY;
    }

    // Get the type of all elements and compute LUB
    const elementTypes = node.elements.map((elem) => elem.accept(this));
    const elementType = Types.getLeastUpperBound(...elementTypes);

    return Types.array(elementType);
  }

  // ========== Identifiers ==========

  visitIdentifier(node: Identifier): Type {
    const symbol = this.symbolTable.resolve(node.name);
    const loc = node.getLocation();

    if (!symbol) {
      this.addError(
        `Undefined variable '${node.name}'`,
        loc.line,
        loc.column,
        node
      );
      return Types.ERROR;
    }

    if (!symbol.initialized && symbol.kind === SymbolKind.VARIABLE) {
      this.addWarning(
        `Variable '${node.name}' may not have been initialized`,
        loc.line,
        loc.column,
        node
      );
    }

    return symbol.type;
  }

  // ========== Binary Expressions ==========

  visitBinaryExpression(node: BinaryExpression): Type {
    const leftType = node.left.accept(this);
    const rightType = node.right.accept(this);

    // Arithmetic operators: +, -, *, /, %, **
    if (["+", "-", "*", "/", "%", "**"].includes(node.operator)) {
      return this.checkArithmeticOperation(
        node.operator,
        leftType,
        rightType,
        node
      );
    }

    // Comparison operators: <, <=, >, >=, ==, !=
    if (
      ["<", "<=", ">", ">=", "==", "!=", "===", "!=="].includes(node.operator)
    ) {
      return this.checkComparisonOperation(
        node.operator,
        leftType,
        rightType,
        node
      );
    }

    // Logical operators: &&, ||
    if (["&&", "||", "and", "or"].includes(node.operator)) {
      return this.checkLogicalOperation(
        node.operator,
        leftType,
        rightType,
        node
      );
    }

    // Bitwise operators: &, |, ^, <<, >>, >>>
    if (["&", "|", "^", "<<", ">>", ">>>"].includes(node.operator)) {
      return this.checkBitwiseOperation(
        node.operator,
        leftType,
        rightType,
        node
      );
    }

    const loc = node.getLocation();
    this.addError(
      `Unknown binary operator '${node.operator}'`,
      loc.line,
      loc.column,
      node
    );
    return Types.ERROR;
  }

  private checkArithmeticOperation(
    operator: string,
    leftType: Type,
    rightType: Type,
    node: BinaryExpression
  ): Type {
    const loc = node.getLocation();

    // Allow ANY type (dynamic typing)
    if (leftType === Types.ANY || rightType === Types.ANY) {
      return Types.ANY;
    }

    // String concatenation with +
    if (
      operator === "+" &&
      (leftType === Types.STRING || rightType === Types.STRING)
    ) {
      return Types.STRING;
    }

    // Both operands must be numeric
    if (!leftType.isNumeric() || !rightType.isNumeric()) {
      this.addError(
        `Operator '${operator}' requires numeric operands, got ${leftType.name} and ${rightType.name}`,
        loc.line,
        loc.column,
        node
      );
      return Types.ERROR;
    }

    // Result type is the LUB of operand types
    if (leftType === Types.REAL || rightType === Types.REAL) {
      return Types.REAL;
    }
    return Types.INT;
  }

  private checkComparisonOperation(
    operator: string,
    leftType: Type,
    rightType: Type,
    node: BinaryExpression
  ): Type {
    // Comparison always returns boolean
    return Types.BOOL;
  }

  private checkLogicalOperation(
    operator: string,
    leftType: Type,
    rightType: Type,
    node: BinaryExpression
  ): Type {
    // Logical operators work on any type (truthiness), return boolean
    return Types.BOOL;
  }

  private checkBitwiseOperation(
    operator: string,
    leftType: Type,
    rightType: Type,
    node: BinaryExpression
  ): Type {
    const loc = node.getLocation();

    // Bitwise operators require integers
    if (leftType !== Types.INT || rightType !== Types.INT) {
      this.addWarning(
        `Bitwise operator '${operator}' expects integer operands, got ${leftType.name} and ${rightType.name}`,
        loc.line,
        loc.column,
        node
      );
    }
    return Types.INT;
  }

  // ========== Unary Expressions ==========

  visitUnaryExpression(node: UnaryExpression): Type {
    const operandType = node.operand.accept(this);
    const loc = node.getLocation();

    switch (node.operator) {
      case "+":
      case "-":
        if (!operandType.isNumeric()) {
          this.addError(
            `Unary '${node.operator}' requires numeric operand, got ${operandType.name}`,
            loc.line,
            loc.column,
            node
          );
          return Types.ERROR;
        }
        return operandType;

      case "!":
      case "not":
        // Logical NOT works on any type, returns boolean
        return Types.BOOL;

      case "~":
        // Bitwise NOT requires integer
        if (operandType !== Types.INT) {
          this.addWarning(
            `Bitwise NOT expects integer operand, got ${operandType.name}`,
            loc.line,
            loc.column,
            node
          );
        }
        return Types.INT;

      case "++":
      case "--":
        // Increment/decrement require numeric type and lvalue
        if (!operandType.isNumeric()) {
          this.addError(
            `Operator '${node.operator}' requires numeric operand, got ${operandType.name}`,
            loc.line,
            loc.column,
            node
          );
          return Types.ERROR;
        }
        return operandType;

      default:
        this.addError(
          `Unknown unary operator '${node.operator}'`,
          loc.line,
          loc.column,
          node
        );
        return Types.ERROR;
    }
  }

  // ========== Assignment ==========

  visitAssignmentExpression(node: AssignmentExpression): Type {
    const targetType = node.left.accept(this);
    const valueType = node.right.accept(this);
    const loc = node.getLocation();

    // Check if target is assignable (identifier or member access)
    if (
      !(node.left instanceof Identifier) &&
      !(node.left instanceof MemberExpression) &&
      !(node.left instanceof ArrayAccessExpression)
    ) {
      this.addError("Invalid assignment target", loc.line, loc.column, node);
      return Types.ERROR;
    }

    // Check if assigning to constant
    if (node.left instanceof Identifier) {
      const symbol = this.symbolTable.resolve(node.left.name);
      if (symbol?.constant) {
        this.addError(
          `Cannot assign to constant variable '${node.left.name}'`,
          loc.line,
          loc.column,
          node
        );
        return Types.ERROR;
      }

      // Mark variable as initialized
      if (node.operator === "=") {
        this.symbolTable.markInitialized(node.left.name);
      }
    }

    // Check type compatibility
    if (node.operator === "=") {
      if (!Types.isAssignable(targetType, valueType)) {
        this.addError(
          `Cannot assign ${valueType.name} to ${targetType.name}`,
          loc.line,
          loc.column,
          node
        );
        return Types.ERROR;
      }
    } else {
      // Compound assignment (+=, -=, etc.)
      const baseOp = node.operator.slice(0, -1); // Remove '='
      this.checkArithmeticOperation(baseOp, targetType, valueType, {
        ...node,
        operator: baseOp,
      } as BinaryExpression);
    }

    return targetType;
  }

  // ========== Function Call ==========

  visitCallExpression(node: CallExpression): Type {
    const calleeType = node.callee.accept(this);
    const loc = node.getLocation();

    if (!calleeType.isFunction()) {
      this.addError(
        `Cannot call non-function type ${calleeType.name}`,
        loc.line,
        loc.column,
        node
      );
      return Types.ERROR;
    }

    const funcType = calleeType as FunctionType;

    // Check argument count
    if (node.args.length !== funcType.parameterTypes.length) {
      this.addError(
        `Function expects ${funcType.parameterTypes.length} arguments, got ${node.args.length}`,
        loc.line,
        loc.column,
        node
      );
    }

    // Check argument types
    for (
      let i = 0;
      i < Math.min(node.args.length, funcType.parameterTypes.length);
      i++
    ) {
      const argType = node.args[i].accept(this);
      const paramType = funcType.parameterTypes[i];

      if (!Types.isAssignable(paramType, argType)) {
        this.addError(
          `Argument ${i + 1} expects ${paramType.name}, got ${argType.name}`,
          loc.line,
          loc.column,
          node
        );
      }
    }

    return funcType.returnType;
  }

  // ========== Member Access ==========

  visitMemberExpression(node: MemberExpression): Type {
    const objectType = node.object.accept(this);

    // For now, return ANY for member access
    // TODO: Implement proper class/object type checking
    return Types.ANY;
  }

  visitArrayAccessExpression(node: ArrayAccessExpression): Type {
    const arrayType = node.array.accept(this);
    const indexType = node.index.accept(this);
    const loc = node.getLocation();

    // Check if index is numeric
    if (!indexType.isNumeric()) {
      this.addWarning(
        `Array index should be numeric, got ${indexType.name}`,
        loc.line,
        loc.column,
        node
      );
    }

    // If array type is known, return element type
    if (arrayType.isArray()) {
      const elemType = (arrayType as any).elementType;
      return elemType || Types.ANY;
    }

    return Types.ANY;
  }

  // ========== Ternary Expression ==========

  visitTernaryExpression(node: TernaryExpression): Type {
    const condType = node.condition.accept(this);
    const consequentType = node.consequent.accept(this);
    const alternateType = node.alternate.accept(this);

    // Result type is LUB of consequent and alternate
    return Types.getLeastUpperBound(consequentType, alternateType);
  }

  // ========== Function Expression ==========

  visitFunctionExpression(node: FunctionExpression): Type {
    // Enter function scope
    this.symbolTable.enterScope("function");
    const previousReturnType = this.currentFunctionReturnType;
    this.currentFunctionReturnType = Types.ANY;

    // Declare parameters
    for (const param of node.params) {
      const paramLoc = param.getLocation();
      this.symbolTable.declareParameter(
        param.name,
        Types.ANY,
        paramLoc.line,
        paramLoc.column
      );
    }

    // Analyze function body
    if (node.body) {
      node.body.accept(this);
    }

    // Exit function scope
    this.currentFunctionReturnType = previousReturnType;
    this.symbolTable.exitScope();

    // Create function type
    const paramTypes = node.params.map(() => Types.ANY);
    return Types.function(Types.ANY, ...paramTypes);
  }

  // ========== Statements ==========

  visitVariableDeclaration(node: VariableDeclaration): Type {
    const varType = node.init ? node.init.accept(this) : Types.ANY;
    const loc = node.getLocation();
    const isGlobal = node.kind === "global";

    const success = isGlobal
      ? this.symbolTable.declareGlobal(
          node.name.name,
          varType,
          loc.line,
          loc.column,
          node.init !== null && node.init !== undefined
        )
      : this.symbolTable.declareVariable(
          node.name.name,
          varType,
          loc.line,
          loc.column,
          false,
          node.init !== null && node.init !== undefined
        );

    if (!success) {
      this.addError(
        `Variable '${node.name.name}' is already declared`,
        loc.line,
        loc.column,
        node
      );
    }

    return Types.VOID;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Type {
    const loc = node.getLocation();

    // Create function type
    const paramTypes = node.params.map(() => Types.ANY); // TODO: Add type annotations
    const funcType = Types.function(Types.ANY, ...paramTypes);

    // Declare function in current scope
    const success = this.symbolTable.declareFunction(
      node.name.name,
      funcType,
      loc.line,
      loc.column
    );

    if (!success) {
      this.addError(
        `Function '${node.name.name}' is already declared`,
        loc.line,
        loc.column,
        node
      );
    }

    // Enter function scope
    this.symbolTable.enterScope("function");
    const previousReturnType = this.currentFunctionReturnType;
    this.currentFunctionReturnType = Types.ANY;

    // Declare parameters
    for (const param of node.params) {
      const paramLoc = param.getLocation();
      this.symbolTable.declareParameter(
        param.name,
        Types.ANY,
        paramLoc.line,
        paramLoc.column
      );
    }

    // Analyze function body
    if (node.body) {
      node.body.accept(this);
    }

    // Exit function scope
    this.currentFunctionReturnType = previousReturnType;
    this.symbolTable.exitScope();

    return Types.VOID;
  }

  visitClassDeclaration(node: ClassDeclaration): Type {
    const loc = node.getLocation();

    // Declare class in current scope
    const success = this.symbolTable.declareClass(
      node.name.name,
      Types.ANY, // TODO: Create proper class type
      loc.line,
      loc.column
    );

    if (!success) {
      this.addError(
        `Class '${node.name.name}' is already declared`,
        loc.line,
        loc.column,
        node
      );
    }

    // Enter class scope
    this.symbolTable.enterScope("class");

    // Analyze class body (methods and fields)
    for (const member of node.body) {
      member.accept(this);
    }

    // Exit class scope
    this.symbolTable.exitScope();

    return Types.VOID;
  }

  visitReturnStatement(node: ReturnStatement): Type {
    const loc = node.getLocation();

    if (!this.symbolTable.isInFunction()) {
      this.addError(
        "Return statement outside of function",
        loc.line,
        loc.column,
        node
      );
      return Types.VOID;
    }

    if (node.argument) {
      const returnType = node.argument.accept(this);
      // TODO: Check against function return type
    }

    return Types.VOID;
  }

  visitIfStatement(node: IfStatement): Type {
    node.condition.accept(this);

    this.symbolTable.enterScope("block");
    node.consequent.accept(this);
    this.symbolTable.exitScope();

    if (node.alternate) {
      this.symbolTable.enterScope("block");
      node.alternate.accept(this);
      this.symbolTable.exitScope();
    }

    return Types.VOID;
  }

  visitWhileStatement(node: WhileStatement): Type {
    node.condition.accept(this);

    this.inLoop++;
    this.symbolTable.enterScope("block");
    node.body.accept(this);
    this.symbolTable.exitScope();
    this.inLoop--;

    return Types.VOID;
  }

  visitForStatement(node: ForStatement): Type {
    this.symbolTable.enterScope("block");

    if (node.init) {
      node.init.accept(this);
    }
    if (node.condition) {
      node.condition.accept(this);
    }
    if (node.update) {
      node.update.accept(this);
    }

    this.inLoop++;
    node.body.accept(this);
    this.inLoop--;

    this.symbolTable.exitScope();

    return Types.VOID;
  }

  visitBreakStatement(node: BreakStatement): Type {
    const loc = node.getLocation();
    if (this.inLoop === 0) {
      this.addError(
        "Break statement outside of loop",
        loc.line,
        loc.column,
        node
      );
    }
    return Types.VOID;
  }

  visitContinueStatement(node: ContinueStatement): Type {
    const loc = node.getLocation();
    if (this.inLoop === 0) {
      this.addError(
        "Continue statement outside of loop",
        loc.line,
        loc.column,
        node
      );
    }
    return Types.VOID;
  }

  visitExpressionStatement(node: ExpressionStatement): Type {
    node.expression.accept(this);
    return Types.VOID;
  }

  visitBlockStatement(node: BlockStatement): Type {
    for (const statement of node.statements) {
      statement.accept(this);
    }
    return Types.VOID;
  }
}
