/**
 * Control flow blocks
 * IfBlock, WhileBlock, ForBlock, DoWhileBlock
 */

import { AbstractBlock } from "./AbstractBlock";
import { Compiler } from "../Compiler";
import { ExpressionAnalyzer } from "../analysis/ExpressionAnalyzer";

/**
 * If statement block
 */
export class IfBlock extends AbstractBlock {
  private condition: any; // Expression
  private elseBlock: AbstractBlock | null = null;

  constructor(condition: any, line: number, hasAccolade: boolean = true) {
    super(line, hasAccolade);
    this.condition = condition;
  }

  getCondition(): any {
    return this.condition;
  }

  setElseBlock(block: AbstractBlock): void {
    this.elseBlock = block;
  }

  getElseBlock(): AbstractBlock | null {
    return this.elseBlock;
  }

  override preAnalyze(compiler: Compiler): void {
    // Analyze condition
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    // Push new scope
    compiler.getSymbolTable().pushScope();
    super.preAnalyze(compiler);
    compiler.getSymbolTable().popScope();

    // Pre-analyze else block if exists
    if (this.elseBlock) {
      this.elseBlock.preAnalyze(compiler);
    }
  }

  override analyze(compiler: Compiler): void {
    // Analyze condition again
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    // Push new scope
    compiler.getSymbolTable().pushScope();
    super.analyze(compiler);
    compiler.getSymbolTable().popScope();

    // Analyze else block if exists
    if (this.elseBlock) {
      this.elseBlock.analyze(compiler);
    }
  }
}

/**
 * While loop block
 */
export class WhileBlock extends AbstractBlock {
  private condition: any; // Expression

  constructor(condition: any, line: number, hasAccolade: boolean = true) {
    super(line, hasAccolade);
    this.condition = condition;
  }

  getCondition(): any {
    return this.condition;
  }

  override preAnalyze(compiler: Compiler): void {
    // Analyze condition
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    compiler.enterLoop();
    compiler.getSymbolTable().pushScope();
    super.preAnalyze(compiler);
    compiler.getSymbolTable().popScope();
    compiler.exitLoop();
  }

  override analyze(compiler: Compiler): void {
    // Analyze condition
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    compiler.enterLoop();
    compiler.getSymbolTable().pushScope();
    super.analyze(compiler);
    compiler.getSymbolTable().popScope();
    compiler.exitLoop();
  }
}

/**
 * For loop block
 */
export class ForBlock extends AbstractBlock {
  private init: any; // Expression or variable declaration
  private condition: any; // Expression
  private increment: any; // Expression

  constructor(
    init: any,
    condition: any,
    increment: any,
    line: number,
    hasAccolade: boolean = true
  ) {
    super(line, hasAccolade);
    this.init = init;
    this.condition = condition;
    this.increment = increment;
  }

  getInit(): any {
    return this.init;
  }

  getCondition(): any {
    return this.condition;
  }

  getIncrement(): any {
    return this.increment;
  }

  override preAnalyze(compiler: Compiler): void {
    compiler.getSymbolTable().pushScope();
    compiler.enterLoop();

    // Pre-analyze init (may declare variables or be an expression)
    if (this.init) {
      // If init is an instruction, call preAnalyze
      if (typeof this.init.preAnalyze === "function") {
        this.init.preAnalyze(compiler);
      } else {
        // If init is an expression, analyze it
        ExpressionAnalyzer.analyzeExpression(this.init, compiler);
      }
    }

    // Analyze condition and increment
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }
    if (this.increment) {
      ExpressionAnalyzer.analyzeExpression(this.increment, compiler);
    }

    super.preAnalyze(compiler);

    compiler.exitLoop();
    compiler.getSymbolTable().popScope();
  }

  override analyze(compiler: Compiler): void {
    compiler.getSymbolTable().pushScope();
    compiler.enterLoop();

    // Analyze init, condition, increment
    if (this.init) {
      if (typeof this.init.analyze === "function") {
        this.init.analyze(compiler);
      } else {
        ExpressionAnalyzer.analyzeExpression(this.init, compiler);
      }
    }
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }
    if (this.increment) {
      ExpressionAnalyzer.analyzeExpression(this.increment, compiler);
    }

    super.analyze(compiler);

    compiler.exitLoop();
    compiler.getSymbolTable().popScope();
  }
}

/**
 * Do-while loop block
 */
export class DoWhileBlock extends AbstractBlock {
  private condition: any; // Expression (set after the block)

  constructor(line: number, hasAccolade: boolean = true) {
    super(line, hasAccolade);
  }

  setCondition(condition: any): void {
    this.condition = condition;
  }

  getCondition(): any {
    return this.condition;
  }

  override preAnalyze(compiler: Compiler): void {
    compiler.getSymbolTable().pushScope();
    compiler.enterLoop();

    super.preAnalyze(compiler);

    // Analyze condition if set (comes after block)
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    compiler.exitLoop();
    compiler.getSymbolTable().popScope();
  }

  override analyze(compiler: Compiler): void {
    compiler.getSymbolTable().pushScope();
    compiler.enterLoop();

    super.analyze(compiler);

    // Analyze condition (comes after block)
    if (this.condition) {
      ExpressionAnalyzer.analyzeExpression(this.condition, compiler);
    }

    compiler.exitLoop();
    compiler.getSymbolTable().popScope();
  }
}
