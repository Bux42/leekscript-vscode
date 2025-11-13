import { Lexer, Token, TokenType } from "../src";
import { test, assertEquals } from "./TestCommon";

describe("Lexer - Basic Functionality", () => {
  it("should create a lexer instance", () => {
    const lexer = new Lexer("var x = 5;");
    expect(lexer).toBeDefined();
  });

  it("should tokenize EOF for empty input", () => {
    const lexer = new Lexer("");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.EOF);
  });

  it("should skip whitespace", () => {
    const lexer = new Lexer("   \t\n  ");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.EOF);
  });
});

describe("Lexer - Numbers", () => {
  it("should tokenize integer", () => {
    const lexer = new Lexer("42");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(2); // NUMBER + EOF
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("42");
  });

  it("should tokenize float", () => {
    const lexer = new Lexer("3.14");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("3.14");
  });

  it("should tokenize scientific notation", () => {
    const lexer = new Lexer("1e10");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("1e10");
  });

  it("should tokenize scientific notation with sign", () => {
    const lexer = new Lexer("1e-10");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("1e-10");
  });

  it("should tokenize infinity symbol", () => {
    const lexer = new Lexer("∞");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("∞");
  });

  it("should tokenize pi symbol", () => {
    const lexer = new Lexer("π");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe("π");
  });
});

describe("Lexer - Strings", () => {
  it("should tokenize single-quoted string", () => {
    const lexer = new Lexer("'hello'");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe("'hello'");
  });

  it("should tokenize double-quoted string", () => {
    const lexer = new Lexer('"world"');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('"world"');
  });

  it("should handle escaped quotes", () => {
    const lexer = new Lexer('"hello \\"world\\""');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('"hello \\"world\\""');
  });

  it("should throw on unclosed string", () => {
    const lexer = new Lexer('"unclosed');
    expect(() => lexer.tokenize()).toThrow("Unclosed string");
  });

  it("should handle empty string", () => {
    const lexer = new Lexer('""');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('""');
  });
});

describe("Lexer - Comments", () => {
  it("should skip single-line comment", () => {
    const lexer = new Lexer("// this is a comment\n42");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(2); // NUMBER + EOF
    expect(tokens[0].type).toBe(TokenType.NUMBER);
  });

  it("should skip multi-line comment", () => {
    const lexer = new Lexer("/* comment */ 42");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(TokenType.NUMBER);
  });

  it("should skip multi-line comment with multiple lines", () => {
    const lexer = new Lexer("/* line 1\nline 2\nline 3 */ 42");
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(TokenType.NUMBER);
  });
});

describe("Lexer - Keywords", () => {
  it("should tokenize var keyword", () => {
    const lexer = new Lexer("var");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.VAR);
  });

  it("should tokenize function keyword", () => {
    const lexer = new Lexer("function");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.FUNCTION);
  });

  it("should tokenize control flow keywords", () => {
    const lexer = new Lexer("if else for while do break continue return");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IF);
    expect(tokens[1].type).toBe(TokenType.ELSE);
    expect(tokens[2].type).toBe(TokenType.FOR);
    expect(tokens[3].type).toBe(TokenType.WHILE);
    expect(tokens[4].type).toBe(TokenType.DO);
    expect(tokens[5].type).toBe(TokenType.BREAK);
    expect(tokens[6].type).toBe(TokenType.CONTINUE);
    expect(tokens[7].type).toBe(TokenType.RETURN);
  });

  it("should tokenize boolean keywords", () => {
    const lexer = new Lexer("true false");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.TRUE);
    expect(tokens[1].type).toBe(TokenType.FALSE);
  });

  it("should tokenize null keyword", () => {
    const lexer = new Lexer("null");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.NULL);
  });

  it("should tokenize logical operators as words", () => {
    const lexer = new Lexer("and or not xor");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.AND);
    expect(tokens[1].type).toBe(TokenType.OR);
    expect(tokens[2].type).toBe(TokenType.NOT);
    expect(tokens[3].type).toBe(TokenType.BIT_XOR);
  });
});

describe("Lexer - Identifiers", () => {
  it("should tokenize simple identifier", () => {
    const lexer = new Lexer("myVar");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("myVar");
  });

  it("should tokenize identifier with underscore", () => {
    const lexer = new Lexer("_private");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("_private");
  });

  it("should tokenize identifier with numbers", () => {
    const lexer = new Lexer("var123");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("var123");
  });
});

describe("Lexer - Operators", () => {
  it("should tokenize arithmetic operators", () => {
    const lexer = new Lexer("+ - * / %");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.PLUS);
    expect(tokens[1].type).toBe(TokenType.MINUS);
    expect(tokens[2].type).toBe(TokenType.TIMES);
    expect(tokens[3].type).toBe(TokenType.DIVIDE);
    expect(tokens[4].type).toBe(TokenType.MODULO);
  });

  it("should tokenize power operator", () => {
    const lexer = new Lexer("**");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.POWER);
  });

  it("should tokenize comparison operators", () => {
    const lexer = new Lexer("== != < <= > >=");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.EQUALS);
    expect(tokens[1].type).toBe(TokenType.NOT_EQUALS);
    expect(tokens[2].type).toBe(TokenType.LESS);
    expect(tokens[3].type).toBe(TokenType.LESS_EQUALS);
    expect(tokens[4].type).toBe(TokenType.GREATER);
    expect(tokens[5].type).toBe(TokenType.GREATER_EQUALS);
  });

  it("should tokenize logical operators", () => {
    const lexer = new Lexer("&& || !");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.AND);
    expect(tokens[1].type).toBe(TokenType.OR);
    expect(tokens[2].type).toBe(TokenType.NOT);
  });

  it("should tokenize bitwise operators", () => {
    const lexer = new Lexer("& | ^ ~ << >>");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.BIT_AND);
    expect(tokens[1].type).toBe(TokenType.BIT_OR);
    expect(tokens[2].type).toBe(TokenType.BIT_XOR);
    expect(tokens[3].type).toBe(TokenType.BIT_NOT);
    expect(tokens[4].type).toBe(TokenType.BIT_SHIFT_LEFT);
    expect(tokens[5].type).toBe(TokenType.BIT_SHIFT_RIGHT);
  });

  it("should tokenize assignment operators", () => {
    const lexer = new Lexer("= += -= *= /= %=");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.ASSIGN);
    expect(tokens[1].type).toBe(TokenType.PLUS_ASSIGN);
    expect(tokens[2].type).toBe(TokenType.MINUS_ASSIGN);
    expect(tokens[3].type).toBe(TokenType.TIMES_ASSIGN);
    expect(tokens[4].type).toBe(TokenType.DIVIDE_ASSIGN);
    expect(tokens[5].type).toBe(TokenType.MODULO_ASSIGN);
  });

  it("should tokenize increment/decrement", () => {
    const lexer = new Lexer("++ --");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.INCREMENT);
    expect(tokens[1].type).toBe(TokenType.DECREMENT);
  });

  it("should tokenize arrow", () => {
    const lexer = new Lexer("=>");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.ARROW);
  });

  it("should tokenize ternary operator parts", () => {
    const lexer = new Lexer("? :");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.QUESTION);
    expect(tokens[1].type).toBe(TokenType.COLON);
  });
});

describe("Lexer - Delimiters", () => {
  it("should tokenize parentheses", () => {
    const lexer = new Lexer("( )");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.LPAREN);
    expect(tokens[1].type).toBe(TokenType.RPAREN);
  });

  it("should tokenize braces", () => {
    const lexer = new Lexer("{ }");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.LBRACE);
    expect(tokens[1].type).toBe(TokenType.RBRACE);
  });

  it("should tokenize brackets", () => {
    const lexer = new Lexer("[ ]");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.LBRACKET);
    expect(tokens[1].type).toBe(TokenType.RBRACKET);
  });

  it("should tokenize comma and semicolon", () => {
    const lexer = new Lexer(", ;");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.COMMA);
    expect(tokens[1].type).toBe(TokenType.SEMICOLON);
  });

  it("should tokenize dot", () => {
    const lexer = new Lexer("x.y", 2); // version 2+ supports dot
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[1].type).toBe(TokenType.DOT);
    expect(tokens[2].type).toBe(TokenType.IDENT);
  });
});

describe("Lexer - Complex Expressions", () => {
  it("should tokenize variable declaration", () => {
    const lexer = new Lexer("var x = 42;");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.VAR);
    expect(tokens[1].type).toBe(TokenType.IDENT);
    expect(tokens[2].type).toBe(TokenType.ASSIGN);
    expect(tokens[3].type).toBe(TokenType.NUMBER);
    expect(tokens[4].type).toBe(TokenType.SEMICOLON);
    expect(tokens[5].type).toBe(TokenType.EOF);
  });

  it("should tokenize function declaration", () => {
    const lexer = new Lexer("function add(a, b) { return a + b; }");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.FUNCTION);
    expect(tokens[1].type).toBe(TokenType.IDENT);
    expect(tokens[2].type).toBe(TokenType.LPAREN);
    expect(tokens[3].type).toBe(TokenType.IDENT);
    expect(tokens[4].type).toBe(TokenType.COMMA);
    expect(tokens[5].type).toBe(TokenType.IDENT);
    expect(tokens[6].type).toBe(TokenType.RPAREN);
    expect(tokens[7].type).toBe(TokenType.LBRACE);
    expect(tokens[8].type).toBe(TokenType.RETURN);
  });

  it("should tokenize array literal", () => {
    const lexer = new Lexer("[1, 2, 3]");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.LBRACKET);
    expect(tokens[1].type).toBe(TokenType.NUMBER);
    expect(tokens[2].type).toBe(TokenType.COMMA);
    expect(tokens[3].type).toBe(TokenType.NUMBER);
    expect(tokens[4].type).toBe(TokenType.COMMA);
    expect(tokens[5].type).toBe(TokenType.NUMBER);
    expect(tokens[6].type).toBe(TokenType.RBRACKET);
  });

  it("should tokenize if statement", () => {
    const lexer = new Lexer("if (x > 0) { return true; }");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IF);
    expect(tokens[1].type).toBe(TokenType.LPAREN);
    expect(tokens[2].type).toBe(TokenType.IDENT);
    expect(tokens[3].type).toBe(TokenType.GREATER);
    expect(tokens[4].type).toBe(TokenType.NUMBER);
    expect(tokens[5].type).toBe(TokenType.RPAREN);
  });
});

describe("Token Class", () => {
  it("should create Token instances with correct properties", () => {
    const token = new Token(TokenType.NUMBER, "42", 1, 1, 0);
    expect(token.type).toBe(TokenType.NUMBER);
    expect(token.value).toBe("42");
    expect(token.line).toBe(1);
    expect(token.column).toBe(1);
    expect(token.position).toBe(0);
  });

  it("should check token type with is() method", () => {
    const token = new Token(TokenType.NUMBER, "42", 1, 1, 0);
    expect(token.is(TokenType.NUMBER)).toBe(true);
    expect(token.is(TokenType.STRING)).toBe(false);
  });

  it("should check multiple token types with isAny() method", () => {
    const token = new Token(TokenType.PLUS, "+", 1, 1, 0);
    expect(token.isAny(TokenType.PLUS, TokenType.MINUS)).toBe(true);
    expect(token.isAny(TokenType.TIMES, TokenType.DIVIDE)).toBe(false);
  });
});
