import { TokenType } from "./TokenType";

/**
 * Represents a single token in the LeekScript source code
 */
export class Token {
  constructor(
    public type: TokenType,
    public value: string,
    public line: number,
    public column: number,
    public position: number
  ) {}

  toString(): string {
    return `Token(${this.type}, '${this.value}', ${this.line}:${this.column})`;
  }

  /**
   * Check if token is of given type
   */
  is(type: TokenType): boolean {
    return this.type === type;
  }

  /**
   * Check if token is any of the given types
   */
  isAny(...types: TokenType[]): boolean {
    return types.includes(this.type);
  }
}
