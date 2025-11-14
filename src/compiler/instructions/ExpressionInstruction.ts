/**
 * Expression instruction
 * Wraps an expression as a statement
 * Ported from Java LeekExpressionInstruction.java
 */

import { Instruction } from "../blocks/AbstractBlock";
import { Compiler } from "../Compiler";
import { Location } from "../types";
import { ExpressionAnalyzer } from "../analysis/ExpressionAnalyzer";

/**
 * Expression statement instruction
 * e.g., functionCall(); or x = 5;
 */
export class ExpressionInstruction implements Instruction {
  private expression: any; // Expression
  private line: number;

  constructor(expression: any, line: number) {
    this.expression = expression;
    this.line = line;
  }

  getExpression(): any {
    return this.expression;
  }

  getLine(): number {
    return this.line;
  }

  /**
   * Pre-analyze: pre-analyze the expression
   */
  preAnalyze(compiler: Compiler): void {
    if (this.expression) {
      ExpressionAnalyzer.analyzeExpression(this.expression, compiler);
    }
  }

  /**
   * Analyze: analyze the expression
   */
  analyze(compiler: Compiler): void {
    if (this.expression) {
      ExpressionAnalyzer.analyzeExpression(this.expression, compiler);
    }
  }
}
