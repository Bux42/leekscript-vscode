/**
 * Variable declaration instruction
 * Handles var, let, const declarations
 * Ported from Java LeekVariableDeclarationInstruction.java
 */

import { Instruction } from "../blocks/AbstractBlock";
import { Compiler } from "../Compiler";
import { AnalyzeErrorLevel, Location } from "../types";
import { ErrorType } from "../ErrorSystem";
import { ExpressionAnalyzer } from "../analysis/ExpressionAnalyzer";
import { Type } from "../type-system/Type";

/**
 * Variable declaration instruction
 * e.g., var x = 5; or let name: string = "test";
 */
export class VariableDeclarationInstruction implements Instruction {
  private name: string;
  private value: any; // Expression
  private declaredType: any; // Type annotation (optional)
  private line: number;
  private location: Location;
  private isConst: boolean;
  private keyword: "var" | "let" | "const";

  constructor(
    name: string,
    value: any,
    declaredType: any,
    line: number,
    location: Location,
    keyword: "var" | "let" | "const" = "var"
  ) {
    this.name = name;
    this.value = value;
    this.declaredType = declaredType;
    this.line = line;
    this.location = location;
    this.keyword = keyword;
    this.isConst = keyword === "const";
  }

  getName(): string {
    return this.name;
  }

  getValue(): any {
    return this.value;
  }

  getDeclaredType(): any {
    return this.declaredType;
  }

  getLine(): number {
    return this.line;
  }

  getLocation(): Location {
    return this.location;
  }

  isConstant(): boolean {
    return this.isConst;
  }

  /**
   * Get a string representation of the value expression for error messages
   */
  private getValueString(expr: any): string {
    if (!expr) return "";

    // Try to get a meaningful representation
    if (expr.constructor?.name === "CallExpression") {
      const callee = expr.callee?.name || "";
      return `${callee}()`;
    }
    if (expr.constructor?.name === "Identifier") {
      return expr.name || "";
    }
    if (expr.constructor?.name === "NumberLiteral") {
      return String(expr.value);
    }
    if (expr.constructor?.name === "StringLiteral") {
      return `"${expr.value}"`;
    }

    return expr.constructor?.name || "expression";
  }

  /**
   * Pre-analyze: register variable in symbol table
   */
  preAnalyze(compiler: Compiler): void {
    const symbolTable = compiler.getSymbolTable();

    // Check if name is available
    if (symbolTable.hasVariableInCurrentScope(this.name)) {
      compiler.getErrorCollector().addError(
        0, // TODO: Get file ID
        this.location,
        AnalyzeErrorLevel.ERROR,
        ErrorType.VARIABLE_NAME_UNAVAILABLE,
        [this.name]
      );
      return;
    }

    // Analyze value expression to infer type
    let inferredType: Type = Type.ANY;
    if (this.value) {
      // Analyze the value expression
      inferredType = ExpressionAnalyzer.analyzeExpression(this.value, compiler);
    }

    // Use declared type if provided, otherwise use inferred type
    const variableType = this.declaredType || inferredType;

    // Register variable in symbol table
    symbolTable.registerVariable(this.name, {
      name: this.name,
      type: variableType,
      line: this.line,
      isGlobal: false,
      isParameter: false,
      isConstant: this.isConst,
    });
  }

  /**
   * Analyze: type check the initialization
   */
  analyze(compiler: Compiler): void {
    if (!this.value) {
      return;
    }

    // Analyze the value expression again (to catch any updates)
    const valueType = ExpressionAnalyzer.analyzeExpression(
      this.value,
      compiler
    );

    // Type checking if there's a declared type
    if (this.declaredType) {
      const cast = this.declaredType.accepts(valueType);

      if (cast === 4) {
        // CastType.INCOMPATIBLE
        // Get location of the assignment operator (=) for more precise error reporting
        // This is stored as __assignLocation by convertV2VariableDeclaration
        const valueLocation =
          (this.value as any).__assignLocation ||
          (this.value?.token
            ? {
                startLine: this.value.token.line,
                startColumn: this.value.token.column,
                endLine: this.value.token.line,
                endColumn:
                  this.value.token.column +
                  (this.value.token.value?.length || 0),
              }
            : this.location);

        // Format error parameters: [expression, actualType, varName, expectedType]
        const params = [
          this.getValueString(this.value),
          valueType.toString(),
          this.name,
          this.declaredType.toString(),
        ];

        compiler.getErrorCollector().addError(
          0, // TODO: Get file ID
          valueLocation,
          AnalyzeErrorLevel.ERROR,
          ErrorType.ASSIGNMENT_INCOMPATIBLE_TYPE,
          params
        );
      } else if (cast === 3) {
        // CastType.UNSAFE_DOWNCAST
        compiler.getErrorCollector().addError(
          0, // TODO: Get file ID
          this.location,
          AnalyzeErrorLevel.WARNING,
          ErrorType.DANGEROUS_CONVERSION_VARIABLE,
          []
        );
      }
    }

    // Update variable type in symbol table with refined type
    const symbolTable = compiler.getSymbolTable();
    const varInfo = symbolTable.lookupVariable(this.name);
    if (varInfo && !this.declaredType) {
      // If no type annotation, use inferred type
      varInfo.type = valueType;
    }
  }
}
