/**
 * Base class for code blocks
 * Ported from Java AbstractLeekBlock.java
 */

import { Compiler } from "../Compiler";

/**
 * Instruction interface
 * Each instruction can be pre-analyzed and analyzed
 */
export interface Instruction {
  /**
   * Pre-analyze phase: register symbols without type checking
   */
  preAnalyze(compiler: Compiler): void;

  /**
   * Analyze phase: type check and validate
   */
  analyze(compiler: Compiler): void;

  /**
   * Get the line number of this instruction
   */
  getLine(): number;
}

/**
 * Abstract block representing a code block with instructions
 */
export abstract class AbstractBlock {
  protected instructions: Instruction[] = [];
  protected parent: AbstractBlock | null = null;
  protected line: number;
  protected full: boolean = false;
  protected hasAccolade: boolean;

  constructor(line: number, hasAccolade: boolean = false) {
    this.line = line;
    this.hasAccolade = hasAccolade;
  }

  /**
   * Add an instruction to this block
   */
  addInstruction(instruction: Instruction): void {
    this.instructions.push(instruction);
  }

  /**
   * Get all instructions
   */
  getInstructions(): Instruction[] {
    return this.instructions;
  }

  /**
   * Pre-analyze all instructions in this block
   */
  preAnalyze(compiler: Compiler): void {
    for (const instruction of this.instructions) {
      instruction.preAnalyze(compiler);
    }
  }

  /**
   * Analyze all instructions in this block
   */
  analyze(compiler: Compiler): void {
    for (const instruction of this.instructions) {
      instruction.analyze(compiler);
    }
  }

  /**
   * Get parent block
   */
  getParent(): AbstractBlock | null {
    return this.parent;
  }

  /**
   * Set parent block
   */
  setParent(parent: AbstractBlock): void {
    this.parent = parent;
  }

  /**
   * Get line number
   */
  getLine(): number {
    return this.line;
  }

  /**
   * Check if block has curly braces
   */
  hasAccolades(): boolean {
    return this.hasAccolade;
  }

  /**
   * Check if block is full (completed)
   */
  isFull(): boolean {
    return this.full;
  }

  /**
   * Set block as full
   */
  setFull(full: boolean): void {
    this.full = full;
  }

  /**
   * End instruction - called when an instruction is complete
   * Returns the block to continue in
   */
  endInstruction(): AbstractBlock {
    if (this.isFull()) {
      if (this.parent) {
        return this.parent.endInstruction();
      }
    }
    return this;
  }

  /**
   * Check end of block - called when closing brace is found
   */
  checkEndBlock(): void {
    // Override in subclasses if needed
  }
}
