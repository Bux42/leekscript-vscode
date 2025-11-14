/**
 * Return instruction
 * Ported from Java LeekReturnInstruction.java
 */

import { Instruction } from "../blocks/AbstractBlock";
import { Compiler } from "../Compiler";
import { Location, AnalyzeErrorLevel } from "../types";
import { ExpressionAnalyzer } from "../analysis/ExpressionAnalyzer";
import { Type, CastType } from "../type-system/Type";
import { ErrorType } from "../ErrorSystem";

/**
 * Return statement instruction
 * e.g., return x + 5;
 */
export class ReturnInstruction implements Instruction {
  private value: any; // Expression (optional, can be null for void return)
  private line: number;
  private location: Location;
  private optional: boolean; // return? (optional return)

  constructor(
    value: any,
    line: number,
    location: Location,
    optional: boolean = false
  ) {
    this.value = value;
    this.line = line;
    this.location = location;
    this.optional = optional;
  }

  getValue(): any {
    return this.value;
  }

  getLine(): number {
    return this.line;
  }

  getLocation(): Location {
    return this.location;
  }

  isOptional(): boolean {
    return this.optional;
  }

  /**
   * Pre-analyze: pre-analyze the return value
   */
  preAnalyze(compiler: Compiler): void {
    if (this.value) {
      // Analyze the return value expression
      ExpressionAnalyzer.analyzeExpression(this.value, compiler);
    }
  }

  /**
   * Analyze: check return type matches function signature
   */
  analyze(compiler: Compiler): void {
    const currentFunction = compiler.getCurrentFunction();

    if (this.value) {
      // Analyze the return value
      const valueType = ExpressionAnalyzer.analyzeExpression(
        this.value,
        compiler
      );

      // Check return type matches function signature
      if (currentFunction && currentFunction.returnType) {
        const cast = currentFunction.returnType.accepts(valueType);

        if (cast === CastType.INCOMPATIBLE) {
          compiler.getErrorCollector().addError(
            0, // fileId - TODO: get from context
            this.location,
            AnalyzeErrorLevel.ERROR,
            ErrorType.INCOMPATIBLE_TYPE,
            [currentFunction.returnType.toString(), valueType.toString()]
          );
        } else if (cast === CastType.UNSAFE_DOWNCAST) {
          compiler
            .getErrorCollector()
            .addError(
              0,
              this.location,
              AnalyzeErrorLevel.WARNING,
              ErrorType.DANGEROUS_CONVERSION,
              [valueType.toString(), currentFunction.returnType.toString()]
            );
        }
      }
    } else {
      // Void return
      // Check if function expects a return value
      if (
        currentFunction &&
        currentFunction.returnType &&
        currentFunction.returnType !== Type.VOID
      ) {
        compiler
          .getErrorCollector()
          .addError(
            0,
            this.location,
            AnalyzeErrorLevel.ERROR,
            ErrorType.VALUE_EXPECTED,
            [currentFunction.name]
          );
      }
    }
  }
}
