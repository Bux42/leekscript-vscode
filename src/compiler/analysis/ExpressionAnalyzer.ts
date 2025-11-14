/**
 * Expression Analysis Extensions
 *
 * Extends the AST Expression nodes with preAnalyze() and analyze() methods
 * for semantic analysis and type checking.
 */

import { Type, CastType, array, compound } from "../type-system/Type";
import { Compiler } from "../Compiler";
import { ErrorType, AnalyzeErrorLevel } from "../ErrorSystem";
import { getFunctionRegistry } from "../FunctionRegistry";
import {
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
} from "../../../leekscript-ts/dist/compiler/ast";

/**
 * Analysis result for expressions
 */
export interface ExpressionAnalysisResult {
  type: Type;
  operations: number;
}

/**
 * Base interface for analyzable expressions
 */
export interface AnalyzableExpression {
  /**
   * Pre-analyze phase: resolve identifiers, register symbols
   */
  preAnalyze(compiler: Compiler): void;

  /**
   * Analyze phase: type checking and validation
   * Returns the resulting type of the expression
   */
  analyze(compiler: Compiler): Type;

  /**
   * Get the inferred/analyzed type
   */
  getAnalyzedType(): Type | null;

  /**
   * Check if this expression can be assigned to (is an l-value)
   */
  isLeftValue(): boolean;

  /**
   * Check if this expression can be null
   */
  nullable(): boolean;
}

/**
 * Mixin to add analysis capabilities to expression nodes
 */
export class ExpressionAnalyzer {
  private static analyzedTypes = new WeakMap<Expression, Type>();

  /**
   * Analyze a NumberLiteral
   */
  static analyzeNumberLiteral(node: NumberLiteral, compiler: Compiler): Type {
    // Integer or real based on whether it has a decimal point
    const type = Number.isInteger(node.value) ? Type.INT : Type.REAL;
    this.analyzedTypes.set(node, type);
    return type;
  }

  /**
   * Analyze a StringLiteral
   */
  static analyzeStringLiteral(node: StringLiteral, compiler: Compiler): Type {
    this.analyzedTypes.set(node, Type.STRING);
    return Type.STRING;
  }

  /**
   * Analyze a BooleanLiteral
   */
  static analyzeBooleanLiteral(node: BooleanLiteral, compiler: Compiler): Type {
    this.analyzedTypes.set(node, Type.BOOL);
    return Type.BOOL;
  }

  /**
   * Analyze a NullLiteral
   */
  static analyzeNullLiteral(node: NullLiteral, compiler: Compiler): Type {
    this.analyzedTypes.set(node, Type.NULL);
    return Type.NULL;
  }

  /**
   * Analyze an ArrayLiteral
   */
  static analyzeArrayLiteral(node: ArrayLiteral, compiler: Compiler): Type {
    // Analyze all elements
    const elementTypes: Type[] = [];

    for (const element of node.elements) {
      const elemType = this.analyzeExpression(element as any, compiler);
      elementTypes.push(elemType);
    }

    // Find common type for all elements
    let commonType: Type = Type.ANY;
    if (elementTypes.length > 0) {
      commonType = elementTypes[0];
      for (let i = 1; i < elementTypes.length; i++) {
        // Find most specific common type
        if (commonType === Type.ANY || elementTypes[i] === Type.ANY) {
          commonType = Type.ANY;
        } else if (commonType.accepts(elementTypes[i]) === CastType.EQUALS) {
          // Same type, keep it
        } else {
          // Different types, use ANY
          commonType = Type.ANY;
        }
      }
    }

    const arrayType = array(commonType);
    this.analyzedTypes.set(node, arrayType);
    return arrayType;
  }

  /**
   * Analyze an Identifier (variable reference)
   */
  static analyzeIdentifier(node: Identifier, compiler: Compiler): Type {
    const symbolTable = compiler.getSymbolTable();
    const registry = getFunctionRegistry();

    // Look up variable
    const varInfo = symbolTable.lookupVariable(node.name);
    if (varInfo) {
      const type = varInfo.type || Type.ANY;
      this.analyzedTypes.set(node, type);
      return type;
    }

    // Look up function
    const funcInfo = symbolTable.lookupFunction(node.name);
    if (funcInfo) {
      const type = Type.FUNCTION; // TODO: Create function type with signature
      this.analyzedTypes.set(node, type);
      return type;
    }

    // Look up class
    const classInfo = symbolTable.lookupClass(node.name);
    const hasClassDecl = symbolTable.hasClassDeclaration(node.name);
    if (classInfo || hasClassDecl) {
      const type = Type.CLASS;
      this.analyzedTypes.set(node, type);
      return type;
    }

    // Look up global
    const hasGlobal = symbolTable.isGlobal(node.name);
    if (hasGlobal) {
      const type = Type.ANY; // Globals are dynamically typed
      this.analyzedTypes.set(node, type);
      return type;
    }

    // Check built-in functions
    if (registry.hasFunction(node.name)) {
      const type = Type.FUNCTION;
      this.analyzedTypes.set(node, type);
      return type;
    }

    // Unknown identifier
    compiler.getErrorCollector().addError({
      level: AnalyzeErrorLevel.ERROR,
      file: 0, // TODO: Get file ID
      location: {
        startLine: node.token.line,
        startColumn: node.token.column,
        endLine: node.token.line,
        endColumn: node.token.column,
      },
      errorType: ErrorType.UNKNOWN_VARIABLE_OR_FUNCTION,
      parameters: [node.name],
    });

    this.analyzedTypes.set(node, Type.ERROR);
    return Type.ERROR;
  }

  /**
   * Analyze a BinaryExpression
   */
  static analyzeBinaryExpression(
    node: BinaryExpression,
    compiler: Compiler
  ): Type {
    // Analyze operands
    const leftType = this.analyzeExpression(node.left as any, compiler);
    const rightType = this.analyzeExpression(node.right as any, compiler);

    let resultType: Type;

    // Determine result type based on operator
    switch (node.operator) {
      // Arithmetic operators
      case "+":
        // String concatenation
        if (leftType === Type.STRING || rightType === Type.STRING) {
          resultType = Type.STRING;
        }
        // Numeric addition
        else if (leftType === Type.REAL || rightType === Type.REAL) {
          resultType = Type.REAL;
        } else if (leftType === Type.INT && rightType === Type.INT) {
          resultType = Type.INT;
        } else {
          resultType = Type.ANY;
        }
        break;

      case "-":
      case "*":
      case "/":
      case "%":
        // Real if either operand is real
        if (leftType === Type.REAL || rightType === Type.REAL) {
          resultType = Type.REAL;
        } else if (leftType === Type.INT && rightType === Type.INT) {
          resultType = Type.INT;
        } else {
          resultType = Type.ANY;
        }
        break;

      case "**": // Power
        resultType = Type.REAL; // Always returns real
        break;

      // Comparison operators
      case "==":
      case "!=":
      case "<":
      case "<=":
      case ">":
      case ">=":
        resultType = Type.BOOL;
        break;

      // Logical operators
      case "&&":
      case "||":
        resultType = Type.BOOL;
        break;

      // Bitwise operators
      case "&":
      case "|":
      case "^":
      case "<<":
      case ">>":
      case ">>>":
        resultType = Type.INT;
        break;

      default:
        resultType = Type.ANY;
    }

    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Analyze a UnaryExpression
   */
  static analyzeUnaryExpression(
    node: UnaryExpression,
    compiler: Compiler
  ): Type {
    const operandType = this.analyzeExpression(node.operand as any, compiler);

    let resultType: Type;

    switch (node.operator) {
      case "!": // Logical NOT
        resultType = Type.BOOL;
        break;

      case "-": // Negation
      case "+": // Unary plus
        resultType =
          operandType === Type.REAL
            ? Type.REAL
            : operandType === Type.INT
            ? Type.INT
            : Type.ANY;
        break;

      case "~": // Bitwise NOT
        resultType = Type.INT;
        break;

      case "++": // Increment
      case "--": // Decrement
        resultType = operandType;
        break;

      default:
        resultType = Type.ANY;
    }

    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Analyze an AssignmentExpression
   */
  static analyzeAssignmentExpression(
    node: AssignmentExpression,
    compiler: Compiler
  ): Type {
    const leftType = this.analyzeExpression(node.left as any, compiler);
    const rightType = this.analyzeExpression(node.right as any, compiler);

    // Check type compatibility
    const castType = leftType.accepts(rightType);

    if (castType === CastType.INCOMPATIBLE) {
      compiler.getErrorCollector().addError({
        level: AnalyzeErrorLevel.ERROR,
        file: 0,
        location: {
          startLine: node.token.line,
          startColumn: node.token.column,
          endLine: node.token.line,
          endColumn: node.token.column,
        },
        errorType: ErrorType.ASSIGNMENT_INCOMPATIBLE_TYPE,
        parameters: [],
      });
    } else if (castType === CastType.UNSAFE_DOWNCAST) {
      compiler.getErrorCollector().addError({
        level: AnalyzeErrorLevel.WARNING,
        file: 0,
        location: {
          startLine: node.token.line,
          startColumn: node.token.column,
          endLine: node.token.line,
          endColumn: node.token.column,
        },
        errorType: ErrorType.DANGEROUS_CONVERSION,
        parameters: [],
      });
    }

    this.analyzedTypes.set(node, leftType);
    return leftType;
  }

  /**
   * Analyze a CallExpression
   */
  static analyzeCallExpression(node: CallExpression, compiler: Compiler): Type {
    const registry = getFunctionRegistry();
    const symbolTable = compiler.getSymbolTable();

    // Analyze callee
    const calleeType = this.analyzeExpression(node.callee as any, compiler);

    // Analyze arguments
    for (const arg of node.args) {
      this.analyzeExpression(arg as any, compiler);
    }

    // Look up function to get return type
    let resultType = Type.ANY;
    let functionFound = false;

    if (node.callee && (node.callee as any).name) {
      const funcName = (node.callee as any).name;

      // First check if it's a class constructor
      const classInfo = symbolTable.lookupClass(funcName);
      if (classInfo) {
        // Class constructor call
        // TODO: Validate constructor parameters
        resultType = Type.OBJECT; // Return instance of class
        functionFound = true;
      }

      // Check user-defined functions
      if (!functionFound) {
        const funcInfo = symbolTable.lookupFunction(funcName);
        if (funcInfo) {
          if (funcInfo.returnType) {
            resultType = funcInfo.returnType;
          }
          functionFound = true;
        }
      }

      // Check built-in functions
      if (!functionFound && registry.hasFunction(funcName)) {
        const builtinFunc = registry.getFunction(funcName);
        if (builtinFunc) {
          // Find matching version based on argument count
          const matchedVersion = registry.matchVersion(
            funcName,
            node.args.length
          );
          if (matchedVersion) {
            // Convert return type string to Type
            resultType = this.parseTypeString(matchedVersion.returnType);
          } else {
            // Function exists but wrong number of arguments
            compiler.getErrorCollector().addError({
              level: AnalyzeErrorLevel.ERROR,
              file: 0,
              location: {
                startLine: node.token?.line || 0,
                startColumn: node.token?.column || 0,
                endLine: node.token?.line || 0,
                endColumn: node.token?.column || 0,
              },
              errorType: ErrorType.INVALID_PARAMETER_COUNT,
              parameters: [funcName, String(node.args.length)],
            });
            resultType = Type.ERROR;
          }
          functionFound = true;
        }
      }

      // If still not found, it's an error (unless it's a dynamic call)
      if (!functionFound && calleeType !== Type.FUNCTION) {
        // Only report error for identifiers (not dynamic expressions)
        if (node.callee && (node.callee as any).type === "Identifier") {
          compiler.getErrorCollector().addError({
            level: AnalyzeErrorLevel.ERROR,
            file: 0,
            location: {
              startLine: node.token?.line || 0,
              startColumn: node.token?.column || 0,
              endLine: node.token?.line || 0,
              endColumn: node.token?.column || 0,
            },
            errorType: ErrorType.UNKNOWN_VARIABLE_OR_FUNCTION,
            parameters: [funcName],
          });
          resultType = Type.ERROR;
        }
      }
    }

    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Parse a type string from the function registry
   */
  private static parseTypeString(typeStr: string): Type {
    // Handle nullable types
    if (typeStr.endsWith("?")) {
      // TODO: Add nullable support to Type system
      const baseType = typeStr.slice(0, -1);
      return this.parseTypeString(baseType);
    }

    // Handle union types
    if (typeStr.includes("|")) {
      // For now, return ANY for union types
      // TODO: Implement proper union type support
      return Type.ANY;
    }

    // Handle array types
    if (typeStr.startsWith("array<")) {
      const elementTypeStr = typeStr.slice(6, -1); // Extract from 'array<...>'
      const elementType = this.parseTypeString(elementTypeStr);
      return array(elementType);
    }

    // Handle basic types
    switch (typeStr) {
      case "void":
        return Type.VOID;
      case "int":
        return Type.INT;
      case "real":
        return Type.REAL;
      case "bool":
        return Type.BOOL;
      case "string":
        return Type.STRING;
      case "any":
        return Type.ANY;
      case "null":
        return Type.NULL;
      default:
        return Type.ANY; // Unknown types default to ANY
    }
  }

  /**
   * Analyze a MemberExpression
   */
  static analyzeMemberExpression(
    node: MemberExpression,
    compiler: Compiler
  ): Type {
    // Analyze object
    const objectType = this.analyzeExpression(node.object as any, compiler);

    // For now, return ANY (TODO: check object member types)
    const resultType = Type.ANY;
    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Analyze an ArrayAccessExpression
   */
  static analyzeArrayAccessExpression(
    node: ArrayAccessExpression,
    compiler: Compiler
  ): Type {
    // Analyze array
    const arrayType = this.analyzeExpression(node.array as any, compiler);

    // Analyze index
    const indexType = this.analyzeExpression(node.index as any, compiler);

    // Extract element type from array type
    // TODO: Implement proper element type extraction
    const resultType = Type.ANY;
    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Analyze a TernaryExpression
   */
  static analyzeTernaryExpression(
    node: TernaryExpression,
    compiler: Compiler
  ): Type {
    // Analyze condition
    this.analyzeExpression(node.condition as any, compiler);

    // Analyze both branches
    const trueType = this.analyzeExpression(node.consequent as any, compiler);
    const falseType = this.analyzeExpression(node.alternate as any, compiler);

    // Result type is union of both branches
    let resultType: Type;
    if (trueType === falseType) {
      resultType = trueType;
    } else if (trueType.accepts(falseType) !== CastType.INCOMPATIBLE) {
      resultType = trueType;
    } else if (falseType.accepts(trueType) !== CastType.INCOMPATIBLE) {
      resultType = falseType;
    } else {
      resultType = compound(trueType, falseType);
    }

    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Analyze a FunctionExpression (lambda/closure)
   */
  static analyzeFunctionExpression(
    node: FunctionExpression,
    compiler: Compiler
  ): Type {
    // For now, just return FUNCTION type
    // TODO: Create function type with proper signature
    const resultType = Type.FUNCTION;
    this.analyzedTypes.set(node, resultType);
    return resultType;
  }

  /**
   * Generic expression analyzer - dispatches to specific analyzers
   */
  static analyzeExpression(node: Expression, compiler: Compiler): Type {
    // Check if already analyzed
    const cached = this.analyzedTypes.get(node);
    if (cached) {
      return cached;
    }

    // Dispatch to specific analyzer based on node type
    if ((node as any).constructor.name === "NumberLiteral") {
      return this.analyzeNumberLiteral(node as NumberLiteral, compiler);
    } else if ((node as any).constructor.name === "StringLiteral") {
      return this.analyzeStringLiteral(node as StringLiteral, compiler);
    } else if ((node as any).constructor.name === "BooleanLiteral") {
      return this.analyzeBooleanLiteral(node as BooleanLiteral, compiler);
    } else if ((node as any).constructor.name === "NullLiteral") {
      return this.analyzeNullLiteral(node as NullLiteral, compiler);
    } else if ((node as any).constructor.name === "ArrayLiteral") {
      return this.analyzeArrayLiteral(node as ArrayLiteral, compiler);
    } else if ((node as any).constructor.name === "Identifier") {
      return this.analyzeIdentifier(node as Identifier, compiler);
    } else if ((node as any).constructor.name === "BinaryExpression") {
      return this.analyzeBinaryExpression(node as BinaryExpression, compiler);
    } else if ((node as any).constructor.name === "UnaryExpression") {
      return this.analyzeUnaryExpression(node as UnaryExpression, compiler);
    } else if ((node as any).constructor.name === "AssignmentExpression") {
      return this.analyzeAssignmentExpression(
        node as AssignmentExpression,
        compiler
      );
    } else if ((node as any).constructor.name === "CallExpression") {
      return this.analyzeCallExpression(node as CallExpression, compiler);
    } else if ((node as any).constructor.name === "MemberExpression") {
      return this.analyzeMemberExpression(node as MemberExpression, compiler);
    } else if ((node as any).constructor.name === "ArrayAccessExpression") {
      return this.analyzeArrayAccessExpression(
        node as ArrayAccessExpression,
        compiler
      );
    } else if ((node as any).constructor.name === "TernaryExpression") {
      return this.analyzeTernaryExpression(node as TernaryExpression, compiler);
    } else if ((node as any).constructor.name === "FunctionExpression") {
      return this.analyzeFunctionExpression(
        node as FunctionExpression,
        compiler
      );
    }

    // Unknown expression type
    console.warn(`Unknown expression type: ${(node as any).constructor.name}`);
    return Type.ANY;
  }

  /**
   * Get the analyzed type of an expression
   */
  static getAnalyzedType(node: Expression): Type | null {
    return this.analyzedTypes.get(node) || null;
  }

  /**
   * Clear all analyzed types (for re-analysis)
   */
  static clearCache(): void {
    this.analyzedTypes = new WeakMap<Expression, Type>();
  }
}
