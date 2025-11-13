import {
  Token,
  TokenType,
  ASTNode,
  Expression,
  Statement,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  ArrayLiteral,
  Identifier,
  BinaryExpression,
  UnaryExpression,
  AssignmentExpression,
  CallExpression,
  MemberExpression,
  ArrayAccessExpression,
  TernaryExpression,
  VariableDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  ClassDeclaration,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
  Program,
  ASTVisitor,
} from "../src";

describe("AST - Literal Nodes", () => {
  it("should create NumberLiteral node", () => {
    const token = new Token(TokenType.NUMBER, "42", 1, 1, 0);
    const node = new NumberLiteral(token, 42, "42");

    expect(node.value).toBe(42);
    expect(node.raw).toBe("42");
    expect(node.token).toBe(token);
    expect(node.toString()).toBe("NumberLiteral(42)");
  });

  it("should create StringLiteral node", () => {
    const token = new Token(TokenType.STRING, '"hello"', 1, 1, 0);
    const node = new StringLiteral(token, "hello", '"hello"');

    expect(node.value).toBe("hello");
    expect(node.raw).toBe('"hello"');
    expect(node.toString()).toBe('StringLiteral("hello")');
  });

  it("should create BooleanLiteral node", () => {
    const token = new Token(TokenType.TRUE, "true", 1, 1, 0);
    const node = new BooleanLiteral(token, true);

    expect(node.value).toBe(true);
    expect(node.toString()).toBe("BooleanLiteral(true)");
  });

  it("should create NullLiteral node", () => {
    const token = new Token(TokenType.NULL, "null", 1, 1, 0);
    const node = new NullLiteral(token);

    expect(node.toString()).toBe("NullLiteral");
  });

  it("should create ArrayLiteral node", () => {
    const token = new Token(TokenType.LBRACKET, "[", 1, 1, 0);
    const elements = [
      new NumberLiteral(new Token(TokenType.NUMBER, "1", 1, 2, 1), 1, "1"),
      new NumberLiteral(new Token(TokenType.NUMBER, "2", 1, 4, 3), 2, "2"),
    ];
    const node = new ArrayLiteral(token, elements);

    expect(node.elements).toHaveLength(2);
    expect(node.toString()).toBe("ArrayLiteral[2]");
  });
});

describe("AST - Expression Nodes", () => {
  it("should create Identifier node", () => {
    const token = new Token(TokenType.IDENT, "myVar", 1, 1, 0);
    const node = new Identifier(token, "myVar");

    expect(node.name).toBe("myVar");
    expect(node.toString()).toBe("Identifier(myVar)");
  });

  it("should create BinaryExpression node", () => {
    const token = new Token(TokenType.PLUS, "+", 1, 3, 2);
    const left = new NumberLiteral(
      new Token(TokenType.NUMBER, "1", 1, 1, 0),
      1,
      "1"
    );
    const right = new NumberLiteral(
      new Token(TokenType.NUMBER, "2", 1, 5, 4),
      2,
      "2"
    );
    const node = new BinaryExpression(token, left, "+", right);

    expect(node.operator).toBe("+");
    expect(node.left).toBe(left);
    expect(node.right).toBe(right);
    expect(node.toString()).toBe("BinaryExpression(+)");
  });

  it("should create UnaryExpression node (prefix)", () => {
    const token = new Token(TokenType.NOT, "!", 1, 1, 0);
    const operand = new Identifier(
      new Token(TokenType.IDENT, "x", 1, 2, 1),
      "x"
    );
    const node = new UnaryExpression(token, "!", operand, true);

    expect(node.operator).toBe("!");
    expect(node.operand).toBe(operand);
    expect(node.prefix).toBe(true);
    expect(node.toString()).toBe("UnaryExpression(!, prefix=true)");
  });

  it("should create UnaryExpression node (postfix)", () => {
    const token = new Token(TokenType.INCREMENT, "++", 1, 2, 1);
    const operand = new Identifier(
      new Token(TokenType.IDENT, "x", 1, 1, 0),
      "x"
    );
    const node = new UnaryExpression(token, "++", operand, false);

    expect(node.prefix).toBe(false);
    expect(node.toString()).toBe("UnaryExpression(++, prefix=false)");
  });

  it("should create AssignmentExpression node", () => {
    const token = new Token(TokenType.ASSIGN, "=", 1, 3, 2);
    const left = new Identifier(new Token(TokenType.IDENT, "x", 1, 1, 0), "x");
    const right = new NumberLiteral(
      new Token(TokenType.NUMBER, "5", 1, 5, 4),
      5,
      "5"
    );
    const node = new AssignmentExpression(token, left, "=", right);

    expect(node.operator).toBe("=");
    expect(node.left).toBe(left);
    expect(node.right).toBe(right);
    expect(node.toString()).toBe("AssignmentExpression(=)");
  });

  it("should create CallExpression node", () => {
    const token = new Token(TokenType.LPAREN, "(", 1, 4, 3);
    const callee = new Identifier(
      new Token(TokenType.IDENT, "func", 1, 1, 0),
      "func"
    );
    const args = [
      new NumberLiteral(new Token(TokenType.NUMBER, "1", 1, 5, 4), 1, "1"),
      new NumberLiteral(new Token(TokenType.NUMBER, "2", 1, 8, 7), 2, "2"),
    ];
    const node = new CallExpression(token, callee, args);

    expect(node.callee).toBe(callee);
    expect(node.args).toHaveLength(2);
    expect(node.toString()).toBe("CallExpression(2 args)");
  });

  it("should create MemberExpression node", () => {
    const token = new Token(TokenType.DOT, ".", 1, 4, 3);
    const object = new Identifier(
      new Token(TokenType.IDENT, "obj", 1, 1, 0),
      "obj"
    );
    const property = new Identifier(
      new Token(TokenType.IDENT, "prop", 1, 5, 4),
      "prop"
    );
    const node = new MemberExpression(token, object, property);

    expect(node.object).toBe(object);
    expect(node.property).toBe(property);
    expect(node.computed).toBe(false);
    expect(node.toString()).toBe("MemberExpression(dot)");
  });

  it("should create ArrayAccessExpression node", () => {
    const token = new Token(TokenType.LBRACKET, "[", 1, 4, 3);
    const array = new Identifier(
      new Token(TokenType.IDENT, "arr", 1, 1, 0),
      "arr"
    );
    const index = new NumberLiteral(
      new Token(TokenType.NUMBER, "0", 1, 5, 4),
      0,
      "0"
    );
    const node = new ArrayAccessExpression(token, array, index);

    expect(node.array).toBe(array);
    expect(node.index).toBe(index);
    expect(node.toString()).toBe("ArrayAccessExpression");
  });

  it("should create TernaryExpression node", () => {
    const token = new Token(TokenType.QUESTION, "?", 1, 3, 2);
    const condition = new Identifier(
      new Token(TokenType.IDENT, "x", 1, 1, 0),
      "x"
    );
    const consequent = new NumberLiteral(
      new Token(TokenType.NUMBER, "1", 1, 5, 4),
      1,
      "1"
    );
    const alternate = new NumberLiteral(
      new Token(TokenType.NUMBER, "2", 1, 9, 8),
      2,
      "2"
    );
    const node = new TernaryExpression(token, condition, consequent, alternate);

    expect(node.condition).toBe(condition);
    expect(node.consequent).toBe(consequent);
    expect(node.alternate).toBe(alternate);
    expect(node.toString()).toBe("TernaryExpression");
  });
});

describe("AST - Statement Nodes", () => {
  it("should create VariableDeclaration node", () => {
    const token = new Token(TokenType.VAR, "var", 1, 1, 0);
    const name = new Identifier(new Token(TokenType.IDENT, "x", 1, 5, 4), "x");
    const init = new NumberLiteral(
      new Token(TokenType.NUMBER, "42", 1, 9, 8),
      42,
      "42"
    );
    const node = new VariableDeclaration(token, "var", name, init);

    expect(node.kind).toBe("var");
    expect(node.name).toBe(name);
    expect(node.init).toBe(init);
    expect(node.toString()).toBe("VariableDeclaration(var x)");
  });

  it("should create VariableDeclaration without initializer", () => {
    const token = new Token(TokenType.VAR, "var", 1, 1, 0);
    const name = new Identifier(new Token(TokenType.IDENT, "x", 1, 5, 4), "x");
    const node = new VariableDeclaration(token, "var", name);

    expect(node.init).toBeUndefined();
  });

  it("should create FunctionDeclaration node", () => {
    const token = new Token(TokenType.FUNCTION, "function", 1, 1, 0);
    const name = new Identifier(
      new Token(TokenType.IDENT, "add", 1, 10, 9),
      "add"
    );
    const params = [
      new Identifier(new Token(TokenType.IDENT, "a", 1, 14, 13), "a"),
      new Identifier(new Token(TokenType.IDENT, "b", 1, 17, 16), "b"),
    ];
    const body = new BlockStatement(
      new Token(TokenType.LBRACE, "{", 1, 19, 18),
      []
    );
    const node = new FunctionDeclaration(token, name, params, body);

    expect(node.name).toBe(name);
    expect(node.params).toHaveLength(2);
    expect(node.body).toBe(body);
    expect(node.toString()).toBe("FunctionDeclaration(add, 2 params)");
  });

  it("should create ClassDeclaration node", () => {
    const token = new Token(TokenType.CLASS, "class", 1, 1, 0);
    const name = new Identifier(
      new Token(TokenType.IDENT, "MyClass", 1, 7, 6),
      "MyClass"
    );
    const node = new ClassDeclaration(token, name, null, []);

    expect(node.name).toBe(name);
    expect(node.superClass).toBeNull();
    expect(node.body).toHaveLength(0);
    expect(node.toString()).toBe("ClassDeclaration(MyClass)");
  });

  it("should create ReturnStatement node", () => {
    const token = new Token(TokenType.RETURN, "return", 1, 1, 0);
    const argument = new NumberLiteral(
      new Token(TokenType.NUMBER, "42", 1, 8, 7),
      42,
      "42"
    );
    const node = new ReturnStatement(token, argument);

    expect(node.argument).toBe(argument);
    expect(node.toString()).toBe("ReturnStatement");
  });

  it("should create ReturnStatement without argument", () => {
    const token = new Token(TokenType.RETURN, "return", 1, 1, 0);
    const node = new ReturnStatement(token);

    expect(node.argument).toBeUndefined();
  });

  it("should create IfStatement node", () => {
    const token = new Token(TokenType.IF, "if", 1, 1, 0);
    const condition = new BooleanLiteral(
      new Token(TokenType.TRUE, "true", 1, 4, 3),
      true
    );
    const consequent = new BlockStatement(
      new Token(TokenType.LBRACE, "{", 1, 9, 8),
      []
    );
    const node = new IfStatement(token, condition, consequent);

    expect(node.condition).toBe(condition);
    expect(node.consequent).toBe(consequent);
    expect(node.alternate).toBeUndefined();
    expect(node.toString()).toBe("IfStatement");
  });

  it("should create WhileStatement node", () => {
    const token = new Token(TokenType.WHILE, "while", 1, 1, 0);
    const condition = new BooleanLiteral(
      new Token(TokenType.TRUE, "true", 1, 7, 6),
      true
    );
    const body = new BlockStatement(
      new Token(TokenType.LBRACE, "{", 1, 12, 11),
      []
    );
    const node = new WhileStatement(token, condition, body);

    expect(node.condition).toBe(condition);
    expect(node.body).toBe(body);
    expect(node.toString()).toBe("WhileStatement");
  });

  it("should create ForStatement node", () => {
    const token = new Token(TokenType.FOR, "for", 1, 1, 0);
    const init = new VariableDeclaration(
      new Token(TokenType.VAR, "var", 1, 5, 4),
      "var",
      new Identifier(new Token(TokenType.IDENT, "i", 1, 9, 8), "i"),
      new NumberLiteral(new Token(TokenType.NUMBER, "0", 1, 13, 12), 0, "0")
    );
    const condition = new BinaryExpression(
      new Token(TokenType.LESS, "<", 1, 18, 17),
      new Identifier(new Token(TokenType.IDENT, "i", 1, 16, 15), "i"),
      "<",
      new NumberLiteral(new Token(TokenType.NUMBER, "10", 1, 20, 19), 10, "10")
    );
    const update = new UnaryExpression(
      new Token(TokenType.INCREMENT, "++", 1, 24, 23),
      "++",
      new Identifier(new Token(TokenType.IDENT, "i", 1, 23, 22), "i"),
      false
    );
    const body = new BlockStatement(
      new Token(TokenType.LBRACE, "{", 1, 27, 26),
      []
    );
    const node = new ForStatement(token, init, condition, update, body);

    expect(node.init).toBe(init);
    expect(node.condition).toBe(condition);
    expect(node.update).toBe(update);
    expect(node.body).toBe(body);
    expect(node.toString()).toBe("ForStatement");
  });

  it("should create BreakStatement node", () => {
    const token = new Token(TokenType.BREAK, "break", 1, 1, 0);
    const node = new BreakStatement(token);

    expect(node.toString()).toBe("BreakStatement");
  });

  it("should create ContinueStatement node", () => {
    const token = new Token(TokenType.CONTINUE, "continue", 1, 1, 0);
    const node = new ContinueStatement(token);

    expect(node.toString()).toBe("ContinueStatement");
  });

  it("should create ExpressionStatement node", () => {
    const token = new Token(TokenType.IDENT, "x", 1, 1, 0);
    const expression = new Identifier(token, "x");
    const node = new ExpressionStatement(token, expression);

    expect(node.expression).toBe(expression);
    expect(node.toString()).toContain("ExpressionStatement");
  });

  it("should create BlockStatement node", () => {
    const token = new Token(TokenType.LBRACE, "{", 1, 1, 0);
    const statements = [
      new BreakStatement(new Token(TokenType.BREAK, "break", 2, 3, 5)),
      new ContinueStatement(
        new Token(TokenType.CONTINUE, "continue", 3, 3, 15)
      ),
    ];
    const node = new BlockStatement(token, statements);

    expect(node.statements).toHaveLength(2);
    expect(node.toString()).toBe("BlockStatement(2 statements)");
  });
});

describe("AST - Program Node", () => {
  it("should create Program node", () => {
    const token = new Token(TokenType.EOF, "", 1, 1, 0);
    const statements = [
      new VariableDeclaration(
        new Token(TokenType.VAR, "var", 1, 1, 0),
        "var",
        new Identifier(new Token(TokenType.IDENT, "x", 1, 5, 4), "x"),
        new NumberLiteral(new Token(TokenType.NUMBER, "42", 1, 9, 8), 42, "42")
      ),
      new ReturnStatement(
        new Token(TokenType.RETURN, "return", 2, 1, 12),
        new Identifier(new Token(TokenType.IDENT, "x", 2, 8, 19), "x")
      ),
    ];
    const node = new Program(token, statements);

    expect(node.statements).toHaveLength(2);
    expect(node.toString()).toBe("Program(2 statements)");
  });
});

describe("AST - Node Location", () => {
  it("should get location from token", () => {
    const token = new Token(TokenType.NUMBER, "42", 5, 10, 50);
    const node = new NumberLiteral(token, 42, "42");
    const location = node.getLocation();

    expect(location.line).toBe(5);
    expect(location.column).toBe(10);
  });
});

describe("AST - Visitor Pattern", () => {
  it("should accept visitor", () => {
    class TestVisitor implements ASTVisitor<string> {
      visitNumberLiteral(node: NumberLiteral): string {
        return `Number: ${node.value}`;
      }
      visitStringLiteral(node: StringLiteral): string {
        return "string";
      }
      visitBooleanLiteral(node: BooleanLiteral): string {
        return "boolean";
      }
      visitNullLiteral(node: NullLiteral): string {
        return "null";
      }
      visitArrayLiteral(node: ArrayLiteral): string {
        return "array";
      }
      visitIdentifier(node: Identifier): string {
        return "identifier";
      }
      visitBinaryExpression(node: BinaryExpression): string {
        return "binary";
      }
      visitUnaryExpression(node: UnaryExpression): string {
        return "unary";
      }
      visitAssignmentExpression(node: AssignmentExpression): string {
        return "assignment";
      }
      visitCallExpression(node: CallExpression): string {
        return "call";
      }
      visitMemberExpression(node: MemberExpression): string {
        return "member";
      }
      visitArrayAccessExpression(node: ArrayAccessExpression): string {
        return "array_access";
      }
      visitTernaryExpression(node: TernaryExpression): string {
        return "ternary";
      }
      visitVariableDeclaration(node: VariableDeclaration): string {
        return "var_decl";
      }
      visitFunctionDeclaration(node: FunctionDeclaration): string {
        return "func_decl";
      }
      visitFunctionExpression(node: FunctionExpression): string {
        return "func_expr";
      }
      visitClassDeclaration(node: ClassDeclaration): string {
        return "class_decl";
      }
      visitReturnStatement(node: ReturnStatement): string {
        return "return";
      }
      visitIfStatement(node: IfStatement): string {
        return "if";
      }
      visitWhileStatement(node: WhileStatement): string {
        return "while";
      }
      visitForStatement(node: ForStatement): string {
        return "for";
      }
      visitBreakStatement(node: BreakStatement): string {
        return "break";
      }
      visitContinueStatement(node: ContinueStatement): string {
        return "continue";
      }
      visitExpressionStatement(node: ExpressionStatement): string {
        return "expr_stmt";
      }
      visitBlockStatement(node: BlockStatement): string {
        return "block";
      }
      visitProgram(node: Program): string {
        return "program";
      }
    }

    const visitor = new TestVisitor();
    const token = new Token(TokenType.NUMBER, "42", 1, 1, 0);
    const node = new NumberLiteral(token, 42, "42");
    const result = node.accept(visitor);

    expect(result).toBe("Number: 42");
  });
});
