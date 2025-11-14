/**
 * Function block - represents a function body
 * Ported from Java FunctionBlock.java
 */

import { AbstractBlock } from "./AbstractBlock";
import { Compiler } from "../Compiler";
import { FunctionInfo } from "../types";

/**
 * Function body block
 */
export class FunctionBlock extends AbstractBlock {
  private functionInfo: FunctionInfo;

  constructor(
    functionInfo: FunctionInfo,
    line: number,
    hasAccolade: boolean = true
  ) {
    super(line, hasAccolade);
    this.functionInfo = functionInfo;
  }

  /**
   * Get function info
   */
  getFunctionInfo(): FunctionInfo {
    return this.functionInfo;
  }

  /**
   * Pre-analyze phase
   * Register function parameters as variables
   */
  override preAnalyze(compiler: Compiler): void {
    // Push function onto stack
    compiler.pushFunction(this.functionInfo);

    // Push new scope for function
    compiler.getSymbolTable().pushScope();

    // Register parameters as variables
    for (let i = 0; i < this.functionInfo.parameters.length; i++) {
      const paramName = this.functionInfo.parameters[i];
      compiler.getSymbolTable().registerVariable(paramName, {
        name: paramName,
        type: null, // TODO: Get type from function signature
        line: this.line,
        isGlobal: false,
        isParameter: true,
        isConstant: false,
      });
    }

    // Pre-analyze function body
    super.preAnalyze(compiler);

    // Pop scope
    compiler.getSymbolTable().popScope();

    // Pop function from stack
    compiler.popFunction();
  }

  /**
   * Analyze phase
   */
  override analyze(compiler: Compiler): void {
    // Push function onto stack
    compiler.pushFunction(this.functionInfo);

    // Push new scope for function
    compiler.getSymbolTable().pushScope();

    // Register parameters again (they were cleared between passes)
    for (let i = 0; i < this.functionInfo.parameters.length; i++) {
      const paramName = this.functionInfo.parameters[i];
      compiler.getSymbolTable().registerVariable(paramName, {
        name: paramName,
        type: null,
        line: this.line,
        isGlobal: false,
        isParameter: true,
        isConstant: false,
      });
    }

    // Analyze function body
    super.analyze(compiler);

    // Pop scope
    compiler.getSymbolTable().popScope();

    // Pop function from stack
    compiler.popFunction();
  }
}
