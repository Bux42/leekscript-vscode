import { Token } from "./Token";
import { TokenType } from "./TokenType";

/**
 * Lexical analyzer for LeekScript
 * Converts source code into a stream of tokens
 * Ported from Java LexicalParser
 */
export class Lexer {
  private tokens: Token[] = [];
  private current = 0;
  private line = 1;
  private column = 0;
  private version = 4; // Default to latest version

  constructor(private source: string, version = 4) {
    this.version = version;
  }

  /**
   * Tokenize the entire source code
   */
  tokenize(): Token[] {
    this.tokens = [];
    this.current = 0;
    this.line = 1;
    this.column = 0;

    while (!this.isAtEnd()) {
      if (this.tryParseWhitespace()) continue;
      if (this.tryParseString()) continue;
      if (this.tryParseComment()) continue;
      if (this.tryParseNumber()) continue;
      if (this.tryParseSpecialIdentifier()) continue;
      if (this.tryParseIdentifier()) continue;
      if (this.tryParseOperator()) continue;
      if (this.tryParseBracket()) continue;
      if (this.tryParseDelimiter()) continue;

      throw new Error(
        `Unexpected character '${this.peek()}' at ${this.line}:${this.column}`
      );
    }

    this.addToken(TokenType.EOF, "");
    return this.tokens;
  }

  // ===== Whitespace =====

  private tryParseWhitespace(): boolean {
    const c = this.peek();
    if (c === " " || c === "\r" || c === "\n" || c === "\t") {
      this.advance();
      return true;
    }
    return false;
  }

  // ===== Comments =====

  private tryParseComment(): boolean {
    // Single-line comment: //
    if (this.peek() === "/" && this.peek(1) === "/") {
      while (!this.isAtEnd() && this.peek() !== "\n") {
        this.advance();
      }
      if (!this.isAtEnd()) this.advance(); // consume \n
      return true;
    }

    // Multi-line comment: /* */
    if (this.peek() === "/" && this.peek(1) === "*") {
      this.advance(); // consume /
      this.advance(); // consume *

      // Special case for version < 2: /*/ is valid
      if (this.version < 2 && this.peek() === "/") {
        this.advance();
        return true;
      }

      while (
        !this.isAtEnd() &&
        !(this.peek() === "*" && this.peek(1) === "/")
      ) {
        this.advance();
      }
      if (!this.isAtEnd()) {
        this.advance(); // consume *
        this.advance(); // consume /
      }
      return true;
    }

    return false;
  }

  // ===== Strings =====

  private tryParseString(): boolean {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      return false;
    }

    const start = this.current;
    this.advance(); // consume opening quote

    let escaped = false;
    let closed = false;

    while (!this.isAtEnd()) {
      const c = this.peek();

      if (c === "\\") {
        escaped = !escaped;
        this.advance();
        continue;
      }

      if (c === quote && !escaped) {
        this.advance(); // consume closing quote
        closed = true;
        break;
      }

      escaped = false;
      this.advance();
    }

    if (!closed) {
      throw new Error(`Unclosed string at ${this.line}:${this.column}`);
    }

    const value = this.source.substring(start, this.current);
    this.addToken(TokenType.STRING, value);
    return true;
  }

  // ===== Numbers =====

  private tryParseNumber(): boolean {
    if (!this.isDigit(this.peek())) {
      return false;
    }

    const start = this.current;
    this.advance();

    let hasDot = false;

    while (!this.isAtEnd()) {
      const c = this.peek();

      // Digits and letters (for hex, binary, scientific notation)
      if (this.isDigit(c) || this.isAlpha(c)) {
        this.advance();
        continue;
      }

      // Scientific notation: e+10, e-5, p+3 (for hex floats)
      if ((c === "-" || c === "+") && this.current > 0) {
        const prev = this.source[this.current - 1].toLowerCase();
        if (prev === "e" || prev === "p") {
          this.advance();
          continue;
        }
      }

      // Decimal point
      if (c === ".") {
        // Don't consume if followed by another dot (..)
        if (this.peek(1) === ".") {
          break;
        }

        // Only one decimal point allowed
        if (hasDot) {
          throw new Error(
            `Invalid number format at ${this.line}:${this.column}`
          );
        }

        hasDot = true;
        this.advance();
        continue;
      }

      break;
    }

    const value = this.source.substring(start, this.current);
    this.addToken(TokenType.NUMBER, value);
    return true;
  }

  // ===== Special Identifiers =====

  private tryParseSpecialIdentifier(): boolean {
    const c = this.peek();

    if (c === "∞") {
      this.advance();
      this.addToken(TokenType.NUMBER, "∞");
      return true;
    }

    if (c === "π") {
      this.advance();
      this.addToken(TokenType.NUMBER, "π");
      return true;
    }

    return false;
  }

  // ===== Identifiers & Keywords =====

  private tryParseIdentifier(): boolean {
    const start = this.current;

    while (!this.isAtEnd()) {
      const c = this.peek();

      if (this.isDigit(c) || this.isAlpha(c) || this.isExtendedAlpha(c)) {
        this.advance();
        continue;
      }

      break;
    }

    if (start === this.current) {
      return false;
    }

    const word = this.source.substring(start, this.current);
    const type = this.getKeywordType(word);
    this.addToken(type, word);
    return true;
  }

  private getKeywordType(word: string): TokenType {
    const w = this.version <= 2 ? word.toLowerCase() : word;

    // Logical operators as words
    if (w === "and") return TokenType.AND;
    if (w === "or") return TokenType.OR;
    if (w === "xor") return TokenType.BIT_XOR;
    if (w === "not") return TokenType.NOT;

    // Keywords
    if (w === "var") return TokenType.VAR;
    if (w === "let" && this.version >= 3) return TokenType.LET;
    if (w === "const" && this.version >= 3) return TokenType.CONST;
    if (w === "global") return TokenType.GLOBAL;
    if (w === "function") return TokenType.FUNCTION;
    if (w === "return") return TokenType.RETURN;
    if (w === "if") return TokenType.IF;
    if (w === "else") return TokenType.ELSE;
    if (w === "for") return TokenType.FOR;
    if (w === "while") return TokenType.WHILE;
    if (w === "do") return TokenType.DO;
    if (w === "break") return TokenType.BREAK;
    if (w === "continue") return TokenType.CONTINUE;
    if (w === "true") return TokenType.TRUE;
    if (w === "false") return TokenType.FALSE;
    if (w === "null") return TokenType.NULL;
    if (w === "new" && this.version >= 2) return TokenType.NEW;
    if (w === "class" && this.version >= 2) return TokenType.CLASS;
    if (w === "extends" && this.version >= 2) return TokenType.EXTENDS;
    if (w === "instanceof" && this.version >= 2) return TokenType.EQUALS; // instanceof is an operator

    // Default: identifier
    return TokenType.IDENT;
  }

  // ===== Operators =====

  private tryParseOperator(): boolean {
    // Order matters! Longer operators first

    // Arrow functions
    if (this.match("=>")) {
      this.addToken(TokenType.ARROW, "=>");
      return true;
    }
    if (this.match("->")) {
      this.addToken(TokenType.ARROW, "->");
      return true;
    }

    // Range operator
    if (this.match("..")) {
      this.addToken(TokenType.DOT, "..");
      return true;
    }

    // Dot (version 2+)
    if (this.version >= 2 && this.peek() === ".") {
      this.advance();
      this.addToken(TokenType.DOT, ".");
      return true;
    }

    // Three-character operators
    if (this.match("===")) {
      this.addToken(TokenType.EQUALS, "===");
      return true;
    }
    if (this.match("!==")) {
      this.addToken(TokenType.NOT_EQUALS, "!==");
      return true;
    }
    if (this.match("**=")) {
      this.addToken(TokenType.POWER_ASSIGN, "**=");
      return true;
    }
    if (this.match("<<<")) {
      this.addToken(TokenType.BIT_SHIFT_LEFT, "<<<");
      return true;
    }
    if (this.match(">>>")) {
      this.addToken(TokenType.BIT_SHIFT_RIGHT_UNSIGNED, ">>>");
      return true;
    }
    if (this.match("<<=")) {
      this.addToken(TokenType.BIT_SHIFT_LEFT, "<<=");
      return true;
    }
    if (this.match(">>=")) {
      this.addToken(TokenType.BIT_SHIFT_RIGHT, ">>=");
      return true;
    }

    // Two-character operators
    if (this.match("&&")) {
      this.addToken(TokenType.AND, "&&");
      return true;
    }
    if (this.match("||")) {
      this.addToken(TokenType.OR, "||");
      return true;
    }
    if (this.match("==")) {
      this.addToken(TokenType.EQUALS, "==");
      return true;
    }
    if (this.match("!=")) {
      this.addToken(TokenType.NOT_EQUALS, "!=");
      return true;
    }
    if (this.match("<=")) {
      this.addToken(TokenType.LESS_EQUALS, "<=");
      return true;
    }
    if (this.match(">=")) {
      this.addToken(TokenType.GREATER_EQUALS, ">=");
      return true;
    }
    if (this.match("<<")) {
      this.addToken(TokenType.BIT_SHIFT_LEFT, "<<");
      return true;
    }
    if (this.match(">>")) {
      this.addToken(TokenType.BIT_SHIFT_RIGHT, ">>");
      return true;
    }
    if (this.match("++")) {
      this.addToken(TokenType.INCREMENT, "++");
      return true;
    }
    if (this.match("--")) {
      this.addToken(TokenType.DECREMENT, "--");
      return true;
    }
    if (this.match("+=")) {
      this.addToken(TokenType.PLUS_ASSIGN, "+=");
      return true;
    }
    if (this.match("-=")) {
      this.addToken(TokenType.MINUS_ASSIGN, "-=");
      return true;
    }
    if (this.match("*=")) {
      this.addToken(TokenType.TIMES_ASSIGN, "*=");
      return true;
    }
    if (this.match("/=")) {
      this.addToken(TokenType.DIVIDE_ASSIGN, "/=");
      return true;
    }
    if (this.match("%=")) {
      this.addToken(TokenType.MODULO_ASSIGN, "%=");
      return true;
    }
    if (this.match("&=")) {
      this.addToken(TokenType.BIT_AND, "&=");
      return true;
    }
    if (this.match("|=")) {
      this.addToken(TokenType.BIT_OR, "|=");
      return true;
    }
    if (this.match("^=")) {
      this.addToken(TokenType.BIT_XOR, "^=");
      return true;
    }
    if (this.match("**")) {
      this.addToken(TokenType.POWER, "**");
      return true;
    }

    // Single-character operators
    if (this.peek() === "+") {
      this.advance();
      this.addToken(TokenType.PLUS, "+");
      return true;
    }
    if (this.peek() === "-") {
      this.advance();
      this.addToken(TokenType.MINUS, "-");
      return true;
    }
    if (this.peek() === "*") {
      this.advance();
      this.addToken(TokenType.TIMES, "*");
      return true;
    }
    if (this.peek() === "/") {
      this.advance();
      this.addToken(TokenType.DIVIDE, "/");
      return true;
    }
    if (this.peek() === "%") {
      this.advance();
      this.addToken(TokenType.MODULO, "%");
      return true;
    }
    if (this.peek() === "=") {
      this.advance();
      this.addToken(TokenType.ASSIGN, "=");
      return true;
    }
    if (this.peek() === "<") {
      this.advance();
      this.addToken(TokenType.LESS, "<");
      return true;
    }
    if (this.peek() === ">") {
      this.advance();
      this.addToken(TokenType.GREATER, ">");
      return true;
    }
    if (this.peek() === "!") {
      this.advance();
      this.addToken(TokenType.NOT, "!");
      return true;
    }
    if (this.peek() === "&") {
      this.advance();
      this.addToken(TokenType.BIT_AND, "&");
      return true;
    }
    if (this.peek() === "|") {
      this.advance();
      this.addToken(TokenType.BIT_OR, "|");
      return true;
    }
    if (this.peek() === "^") {
      this.advance();
      this.addToken(TokenType.BIT_XOR, "^");
      return true;
    }
    if (this.peek() === "~") {
      this.advance();
      this.addToken(TokenType.BIT_NOT, "~");
      return true;
    }
    if (this.peek() === "?") {
      this.advance();
      this.addToken(TokenType.QUESTION, "?");
      return true;
    }
    if (this.peek() === ":") {
      this.advance();
      this.addToken(TokenType.COLON, ":");
      return true;
    }

    return false;
  }

  // ===== Brackets & Delimiters =====

  private tryParseBracket(): boolean {
    const c = this.peek();

    if (c === "(") {
      this.advance();
      this.addToken(TokenType.LPAREN, "(");
      return true;
    }
    if (c === ")") {
      this.advance();
      this.addToken(TokenType.RPAREN, ")");
      return true;
    }
    if (c === "{") {
      this.advance();
      this.addToken(TokenType.LBRACE, "{");
      return true;
    }
    if (c === "}") {
      this.advance();
      this.addToken(TokenType.RBRACE, "}");
      return true;
    }
    if (c === "[") {
      this.advance();
      this.addToken(TokenType.LBRACKET, "[");
      return true;
    }
    if (c === "]") {
      this.advance();
      this.addToken(TokenType.RBRACKET, "]");
      return true;
    }

    return false;
  }

  private tryParseDelimiter(): boolean {
    const c = this.peek();

    if (c === ",") {
      this.advance();
      this.addToken(TokenType.COMMA, ",");
      return true;
    }
    if (c === ";") {
      this.advance();
      this.addToken(TokenType.SEMICOLON, ";");
      return true;
    }

    return false;
  }

  // ===== Helper Methods =====

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    const c = this.source[this.current];
    this.current++;

    if (c === "\n") {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }

    return c;
  }

  private peek(offset = 0): string {
    const index = this.current + offset;
    if (index >= this.source.length) return "\0";
    return this.source[index];
  }

  private match(expected: string): boolean {
    for (let i = 0; i < expected.length; i++) {
      if (this.peek(i) !== expected[i]) {
        return false;
      }
    }

    for (let i = 0; i < expected.length; i++) {
      this.advance();
    }

    return true;
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push(
      new Token(type, value, this.line, this.column, this.current)
    );
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  }

  private isExtendedAlpha(c: string): boolean {
    // Support for extended characters (accented letters, etc.)
    return (
      (c >= "À" && c <= "Ö") ||
      (c >= "à" && c <= "ö") ||
      (c >= "Ø" && c <= "Ý") ||
      (c >= "ø" && c <= "ý") ||
      (c >= "Œ" && c <= "œ") ||
      c === "ÿ"
    );
  }
}
