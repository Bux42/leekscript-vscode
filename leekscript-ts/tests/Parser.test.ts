import { Parser } from "../src";

describe("Parser - Literals", () => {
  it("should parse number literal", () => {
    const parser = new Parser("42");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    const stmt = program.statements[0];
    expect(stmt.constructor.name).toBe("ExpressionStatement");
  });

  it("should parse string literal", () => {
    const parser = new Parser('"hello"');
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse boolean literals", () => {
    const parser = new Parser("true; false;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(2);
  });

  it("should parse null literal", () => {
    const parser = new Parser("null");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse array literal", () => {
    const parser = new Parser("[1, 2, 3]");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse empty array", () => {
    const parser = new Parser("[]");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Binary Expressions", () => {
  it("should parse addition", () => {
    const parser = new Parser("1 + 2");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse multiplication", () => {
    const parser = new Parser("3 * 4");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse complex expression with precedence", () => {
    const parser = new Parser("1 + 2 * 3");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse comparison", () => {
    const parser = new Parser("x < 10");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse logical operators", () => {
    const parser = new Parser("a && b || c");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse power operator", () => {
    const parser = new Parser("2 ** 8");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Unary Expressions", () => {
  it("should parse prefix operators", () => {
    const parser = new Parser("!x; -y; ++z;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(3);
  });

  it("should parse postfix operators", () => {
    const parser = new Parser("x++; y--;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(2);
  });
});

describe("Parser - Variable Declarations", () => {
  it("should parse var declaration with init", () => {
    const parser = new Parser("var x = 5;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    const stmt = program.statements[0];
    expect(stmt.constructor.name).toBe("VariableDeclaration");
  });

  it("should parse var declaration without init", () => {
    const parser = new Parser("var x;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse global declaration", () => {
    const parser = new Parser("global myGlobal = 42;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Assignment", () => {
  it("should parse simple assignment", () => {
    const parser = new Parser("x = 5");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse compound assignment", () => {
    const parser = new Parser("x += 5; y *= 2;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(2);
  });
});

describe("Parser - Function Calls", () => {
  it("should parse function call with no args", () => {
    const parser = new Parser("func()");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse function call with args", () => {
    const parser = new Parser("func(1, 2, 3)");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse nested function calls", () => {
    const parser = new Parser("outer(inner(x))");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Member Access", () => {
  it("should parse dot notation", () => {
    const parser = new Parser("obj.property", 2); // version 2+ for dot support
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse chained member access", () => {
    const parser = new Parser("obj.prop1.prop2", 2);
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse array access", () => {
    const parser = new Parser("arr[0]");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse array access with expression", () => {
    const parser = new Parser("arr[i + 1]");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Ternary Expression", () => {
  it("should parse ternary operator", () => {
    const parser = new Parser("x > 0 ? 1 : -1");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse nested ternary", () => {
    const parser = new Parser("a ? b ? c : d : e");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - If Statement", () => {
  it("should parse if without else", () => {
    const parser = new Parser("if (x > 0) return x;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("IfStatement");
  });

  it("should parse if with else", () => {
    const parser = new Parser("if (x > 0) return 1; else return -1;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse if with block", () => {
    const parser = new Parser("if (x > 0) { var y = x; return y; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - While Statement", () => {
  it("should parse while loop", () => {
    const parser = new Parser("while (x < 10) x++;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("WhileStatement");
  });

  it("should parse while with block", () => {
    const parser = new Parser("while (x < 10) { x++; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse do-while loop", () => {
    const parser = new Parser("do x++; while (x < 10);");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - For Statement", () => {
  it("should parse for loop", () => {
    const parser = new Parser("for (var i = 0; i < 10; i++) sum += i;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("ForStatement");
  });

  it("should parse for loop with empty clauses", () => {
    const parser = new Parser("for (;;) break;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse for loop with block", () => {
    const parser = new Parser("for (var i = 0; i < 10; i++) { sum += i; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Function Declaration", () => {
  it("should parse function with no params", () => {
    const parser = new Parser("function foo() { return 42; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("FunctionDeclaration");
  });

  it("should parse function with params", () => {
    const parser = new Parser("function add(a, b) { return a + b; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse function with multiple statements", () => {
    const parser = new Parser(`
      function complex(x) {
        var y = x * 2;
        var z = y + 1;
        return z;
      }
    `);
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Class Declaration", () => {
  it("should parse empty class", () => {
    const parser = new Parser("class MyClass {}", 2); // version 2+ for class support
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("ClassDeclaration");
  });

  it("should parse class with methods", () => {
    const parser = new Parser(
      `
      class MyClass {
        function method1() {}
        function method2(x) { return x; }
      }
    `,
      2
    );
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Return Statement", () => {
  it("should parse return with value", () => {
    const parser = new Parser("return 42;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("ReturnStatement");
  });

  it("should parse return without value", () => {
    const parser = new Parser("return;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Break and Continue", () => {
  it("should parse break statement", () => {
    const parser = new Parser("break;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("BreakStatement");
  });

  it("should parse continue statement", () => {
    const parser = new Parser("continue;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("ContinueStatement");
  });
});

describe("Parser - Block Statement", () => {
  it("should parse empty block", () => {
    const parser = new Parser("{}");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0].constructor.name).toBe("BlockStatement");
  });

  it("should parse block with statements", () => {
    const parser = new Parser("{ var x = 1; var y = 2; return x + y; }");
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });
});

describe("Parser - Complex Programs", () => {
  it("should parse multiple statements", () => {
    const parser = new Parser(`
      var x = 5;
      var y = 10;
      var sum = x + y;
    `);
    const program = parser.parse();

    expect(program.statements).toHaveLength(3);
  });

  it("should parse function with complex body", () => {
    const parser = new Parser(`
      function fibonacci(n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
    `);
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should parse nested control flow", () => {
    const parser = new Parser(`
      for (var i = 0; i < 10; i++) {
        if (i % 2 == 0) {
          sum += i;
        } else {
          continue;
        }
      }
    `);
    const program = parser.parse();

    expect(program.statements).toHaveLength(1);
  });

  it("should handle semicolons correctly", () => {
    const parser = new Parser("var x = 1; var y = 2;;; var z = 3;");
    const program = parser.parse();

    expect(program.statements).toHaveLength(3);
  });
});

describe("Parser - Error Handling", () => {
  it("should throw on unexpected token", () => {
    const parser = new Parser("@@@");
    expect(() => parser.parse()).toThrow();
  });

  it("should throw on missing closing paren", () => {
    const parser = new Parser("func(1, 2");
    expect(() => parser.parse()).toThrow();
  });

  it("should throw on missing closing bracket", () => {
    const parser = new Parser("[1, 2, 3");
    expect(() => parser.parse()).toThrow();
  });

  it("should throw on missing closing brace", () => {
    const parser = new Parser("if (x > 0) {");
    expect(() => parser.parse()).toThrow();
  });
});
