/**
 * Global variable declaration instruction
 * Ported from Java LeekGlobalDeclarationInstruction.java
 */

import { Instruction } from "../blocks/AbstractBlock";
import { Compiler } from "../Compiler";
import { AnalyzeErrorLevel, Location } from "../types";
import { ErrorType } from "../ErrorSystem";
import { ExpressionAnalyzer } from "../analysis/ExpressionAnalyzer";
import { Type, CastType } from "../type-system/Type";

/**
 * Global variable declaration instruction
 * e.g., global myGlobal = 10;
 */
export class GlobalDeclarationInstruction implements Instruction {
  private name: string;
  private value: any; // Expression (optional)
  private declaredType: any; // Type annotation (optional)
  private line: number;
  private location: Location;

  constructor(
    name: string,
    value: any,
    declaredType: any,
    line: number,
    location: Location
  ) {
    this.name = name;
    this.value = value;
    this.declaredType = declaredType;
    this.line = line;
    this.location = location;
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

  /**
   * Pre-analyze: register global variable
   */
  preAnalyze(compiler: Compiler): void {
    const symbolTable = compiler.getSymbolTable();

    // Check if global name is available
    if (!symbolTable.isGlobalNameAvailable(this.name)) {
      compiler.getErrorCollector().addError(
        0, // TODO: Get file ID
        this.location,
        AnalyzeErrorLevel.ERROR,
        ErrorType.VARIABLE_NAME_UNAVAILABLE,
        [this.name]
      );
      return;
    }

    // Register global (globals are always dynamically typed as ANY)
    symbolTable.registerGlobal(this.name);

    // Analyze value if exists
    if (this.value) {
      ExpressionAnalyzer.analyzeExpression(this.value, compiler);
    }
  }

  /**
   * Analyze: type check the initialization
   */
  analyze(compiler: Compiler): void {
    if (!this.value) {
      return;
    }

    // Analyze value expression
    const valueType = ExpressionAnalyzer.analyzeExpression(
      this.value,
      compiler
    );

    // Type checking if there's a declared type
    if (this.declaredType) {
      const cast = this.declaredType.accepts(valueType);

      if (cast === CastType.INCOMPATIBLE) {
        compiler.getErrorCollector().addError(
          0, // TODO: Get file ID
          this.location,
          AnalyzeErrorLevel.ERROR,
          ErrorType.ASSIGNMENT_INCOMPATIBLE_TYPE,
          []
        );
      } else if (cast === CastType.UNSAFE_DOWNCAST) {
        compiler.getErrorCollector().addError(
          0, // TODO: Get file ID
          this.location,
          AnalyzeErrorLevel.WARNING,
          ErrorType.DANGEROUS_CONVERSION,
          []
        );
      }
    }
  }
}
