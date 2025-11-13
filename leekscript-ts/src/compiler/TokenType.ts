/**
 * Token types in LeekScript language
 * Ported from Java TokenType enum
 */
export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  BOOLEAN = "BOOLEAN",
  NULL = "NULL",

  // Identifiers and Keywords
  IDENT = "IDENT",
  FUNCTION = "FUNCTION",
  CLASS = "CLASS",
  EXTENDS = "EXTENDS",
  VAR = "VAR",
  LET = "LET",
  CONST = "CONST",
  GLOBAL = "GLOBAL",
  IF = "IF",
  ELSE = "ELSE",
  FOR = "FOR",
  WHILE = "WHILE",
  DO = "DO",
  BREAK = "BREAK",
  CONTINUE = "CONTINUE",
  RETURN = "RETURN",
  NEW = "NEW",
  TRUE = "TRUE",
  FALSE = "FALSE",

  // Operators
  PLUS = "PLUS", // +
  MINUS = "MINUS", // -
  TIMES = "TIMES", // *
  DIVIDE = "DIVIDE", // /
  MODULO = "MODULO", // %
  POWER = "POWER", // **

  // Comparison
  EQUALS = "EQUALS", // ==
  NOT_EQUALS = "NOT_EQUALS", // !=
  LESS = "LESS", // <
  LESS_EQUALS = "LESS_EQUALS", // <=
  GREATER = "GREATER", // >
  GREATER_EQUALS = "GREATER_EQUALS", // >=

  // Logical
  AND = "AND", // &&
  OR = "OR", // ||
  NOT = "NOT", // !

  // Bitwise
  BIT_AND = "BIT_AND", // &
  BIT_OR = "BIT_OR", // |
  BIT_XOR = "BIT_XOR", // ^
  BIT_NOT = "BIT_NOT", // ~
  BIT_SHIFT_LEFT = "BIT_SHIFT_LEFT", // <<
  BIT_SHIFT_RIGHT = "BIT_SHIFT_RIGHT", // >>
  BIT_SHIFT_RIGHT_UNSIGNED = "BIT_SHIFT_RIGHT_UNSIGNED", // >>>

  // Assignment
  ASSIGN = "ASSIGN", // =
  PLUS_ASSIGN = "PLUS_ASSIGN", // +=
  MINUS_ASSIGN = "MINUS_ASSIGN", // -=
  TIMES_ASSIGN = "TIMES_ASSIGN", // *=
  DIVIDE_ASSIGN = "DIVIDE_ASSIGN", // /=
  MODULO_ASSIGN = "MODULO_ASSIGN", // %=
  POWER_ASSIGN = "POWER_ASSIGN", // **=

  // Increment/Decrement
  INCREMENT = "INCREMENT", // ++
  DECREMENT = "DECREMENT", // --

  // Delimiters
  LPAREN = "LPAREN", // (
  RPAREN = "RPAREN", // )
  LBRACE = "LBRACE", // {
  RBRACE = "RBRACE", // }
  LBRACKET = "LBRACKET", // [
  RBRACKET = "RBRACKET", // ]
  SEMICOLON = "SEMICOLON", // ;
  COMMA = "COMMA", // ,
  DOT = "DOT", // .
  COLON = "COLON", // :
  QUESTION = "QUESTION", // ?
  ARROW = "ARROW", // =>

  // Special
  EOF = "EOF",
  COMMENT_LINE = "COMMENT_LINE", // //
  COMMENT_BLOCK = "COMMENT_BLOCK", // /* */
}
