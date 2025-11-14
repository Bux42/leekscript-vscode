/**
 * Break and Continue instructions
 * Ported from Java LeekBreakInstruction.java and LeekContinueInstruction.java
 */

import { Instruction } from "../blocks/AbstractBlock";
import { Compiler } from "../Compiler";
import { Location } from "../types";

/**
 * Break statement
 * e.g., break;
 */
export class BreakInstruction implements Instruction {
  private line: number;
  private location: Location;

  constructor(line: number, location: Location) {
    this.line = line;
    this.location = location;
  }

  getLine(): number {
    return this.line;
  }

  getLocation(): Location {
    return this.location;
  }

  preAnalyze(compiler: Compiler): void {
    // Nothing to do in pre-analyze
  }

  analyze(compiler: Compiler): void {
    // Check if we're inside a loop
    if (!compiler.isInLoop()) {
      compiler.getErrorCollector().addError({
        level: require("../types").AnalyzeErrorLevel.ERROR,
        file: 0, // TODO: get fileId from context
        location: this.location,
        errorType: require("../ErrorSystem").ErrorType.BREAK_OUT_OF_LOOP,
        parameters: [],
      });
    }
  }
}

/**
 * Continue statement
 * e.g., continue;
 */
export class ContinueInstruction implements Instruction {
  private line: number;
  private location: Location;

  constructor(line: number, location: Location) {
    this.line = line;
    this.location = location;
  }

  getLine(): number {
    return this.line;
  }

  getLocation(): Location {
    return this.location;
  }

  preAnalyze(compiler: Compiler): void {
    // Nothing to do in pre-analyze
  }

  analyze(compiler: Compiler): void {
    // Check if we're inside a loop
    if (!compiler.isInLoop()) {
      compiler.getErrorCollector().addError({
        level: require("../types").AnalyzeErrorLevel.ERROR,
        file: 0, // TODO: get fileId from context
        location: this.location,
        errorType: require("../ErrorSystem").ErrorType.CONTINUE_OUT_OF_LOOP,
        parameters: [],
      });
    }
  }
}
