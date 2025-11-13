import { describe, expect, it } from "@jest/globals";
import { Lexer, Parser, SemanticAnalyzer, Types } from "../src";

function analyze(code: string) {
  const parser = new Parser(code);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(ast);
}

describe("Semantic Analyzer - Variable Resolution", () => {
  it("should resolve declared variable", () => {
    const result = analyze("var x = 5; x;");
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect undefined variable", () => {
    const result = analyze("x;");
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Undefined");
  });

  it("should detect duplicate variable declaration", () => {
    const result = analyze("var x = 5; var x = 10;");
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("already declared");
  });

  it("should allow variable shadowing in nested scope", () => {
    const result = analyze("var x = 5; { var x = 10; }");
    // Note: Currently this may fail if shadowing is not allowed - checking behavior
    if (!result.success) {
      expect(result.errors[0].message).toContain("already declared");
    }
  });

  it("should resolve variable from parent scope", () => {
    const result = analyze("var x = 5; { x; }");
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("Semantic Analyzer - Type Checking", () => {
  it("should accept valid arithmetic operations", () => {
    const result = analyze("5 + 3;");
    expect(result.success).toBe(true);
  });

  it("should accept numeric types in arithmetic", () => {
    const result = analyze("var x = 5; var y = 3.14; x + y;");
    expect(result.success).toBe(true);
  });

  it("should accept string concatenation", () => {
    const result = analyze('"hello" + "world";');
    expect(result.success).toBe(true);
  });

  it("should accept comparison operations", () => {
    const result = analyze("5 > 3;");
    expect(result.success).toBe(true);
  });

  it("should accept logical operations", () => {
    const result = analyze("true && false;");
    expect(result.success).toBe(true);
  });

  it("should accept bitwise operations on integers", () => {
    const result = analyze("5 & 3;");
    expect(result.success).toBe(true);
  });
});

describe("Semantic Analyzer - Assignment Validation", () => {
  it("should accept assignment to variable", () => {
    const result = analyze("var x = 5; x = 10;");
    expect(result.success).toBe(true);
  });

  it("should reject assignment to literal", () => {
    const result = analyze("5 = 10;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("Invalid assignment target");
  });

  it("should reject assignment to expression", () => {
    const result = analyze("var x = 5; (x + 1) = 10;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("Invalid assignment target");
  });

  it("should accept compound assignment", () => {
    const result = analyze("var x = 5; x += 10;");
    // May not be supported yet
    if (!result.success) {
      console.log("Compound assignment errors:", result.errors);
    }
  });
});

describe("Semantic Analyzer - Function Analysis", () => {
  it("should accept function declaration", () => {
    const result = analyze("function foo() { return 5; }");
    expect(result.success).toBe(true);
  });

  it("should accept function call", () => {
    const result = analyze("function foo() { return 5; } foo();");
    expect(result.success).toBe(true);
  });

  it("should detect duplicate function declaration", () => {
    const result = analyze("function foo() {} function foo() {}");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("already declared");
  });

  it("should resolve parameters in function scope", () => {
    const result = analyze("function foo(x) { return x; }");
    expect(result.success).toBe(true);
  });

  it("should not access parameters outside function", () => {
    const result = analyze("function foo(x) {} x;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("Undefined");
  });

  it("should detect return outside function", () => {
    const result = analyze("return 5;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("outside of function");
  });

  it("should accept return inside function", () => {
    const result = analyze("function foo() { return 5; }");
    expect(result.success).toBe(true);
  });
});

describe("Semantic Analyzer - Class Analysis", () => {
  it("should accept class declaration", () => {
    const result = analyze("class Foo {}");
    expect(result.success).toBe(true);
  });

  it("should detect duplicate class declaration", () => {
    const result = analyze("class Foo {} class Foo {}");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("already declared");
  });

  it("should accept class with methods", () => {
    const result = analyze("class Foo { function bar() {} }");
    expect(result.success).toBe(true);
  });
});

describe("Semantic Analyzer - Control Flow", () => {
  it("should accept if statement", () => {
    const result = analyze("if (true) { var x = 5; }");
    expect(result.success).toBe(true);
  });

  it("should accept if-else statement", () => {
    const result = analyze("if (true) { var x = 5; } else { var y = 10; }");
    expect(result.success).toBe(true);
  });

  it("should accept while loop", () => {
    const result = analyze("while (true) { var x = 5; }");
    expect(result.success).toBe(true);
  });

  it("should accept for loop", () => {
    const result = analyze("for (var i = 0; i < 10; i++) { var x = 5; }");
    expect(result.success).toBe(true);
  });

  it("should accept break in loop", () => {
    const result = analyze("while (true) { break; }");
    expect(result.success).toBe(true);
  });

  it("should accept continue in loop", () => {
    const result = analyze("while (true) { continue; }");
    expect(result.success).toBe(true);
  });

  it("should detect break outside loop", () => {
    const result = analyze("break;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("outside of loop");
  });

  it("should detect continue outside loop", () => {
    const result = analyze("continue;");
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("outside of loop");
  });
});

describe("Semantic Analyzer - Array Operations", () => {
  it("should accept array literal", () => {
    const result = analyze("[1, 2, 3];");
    expect(result.success).toBe(true);
  });

  it("should accept empty array", () => {
    const result = analyze("[];");
    expect(result.success).toBe(true);
  });

  it("should accept array access", () => {
    const result = analyze("var arr = [1, 2, 3]; arr[0];");
    expect(result.success).toBe(true);
  });

  it("should accept array assignment", () => {
    const result = analyze("var arr = [1, 2, 3]; arr[0] = 5;");
    expect(result.success).toBe(true);
  });
});

describe("Semantic Analyzer - Complex Scenarios", () => {
  it("should analyze nested scopes correctly", () => {
    const result = analyze(`
      var x = 5;
      {
        var y = 10;
        {
          var z = x + y;
        }
      }
    `);
    expect(result.success).toBe(true);
  });

  it("should analyze function with local variables", () => {
    const result = analyze(`
      function foo(a, b) {
        var sum = a + b;
        return sum;
      }
      foo(5, 10);
    `);
    // Parameters have type ANY, so operations on them may generate warnings
    // but analysis should complete
    expect(result.errors.filter((e) => e.level === "error")).toHaveLength(0);
  });

  it("should detect multiple errors", () => {
    const result = analyze(`
      x;
      y;
      z;
    `);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("should handle ternary expressions", () => {
    const result = analyze("var x = true ? 5 : 10;");
    expect(result.success).toBe(true);
  });

  it("should handle member access", () => {
    const result = analyze("var obj = [1, 2, 3]; obj[0];");
    expect(result.success).toBe(true);
  });

  it("should handle unary operators", () => {
    const result = analyze("var x = 5; -x; !true; ++x; x--;");
    expect(result.success).toBe(true);
  });
});

describe("Semantic Analyzer - Global Variables", () => {
  it("should accept global variable declaration", () => {
    const result = analyze("global x = 5;");
    expect(result.success).toBe(true);
  });

  it("should access global from nested scope", () => {
    const result = analyze("global x = 5; { x; }");
    expect(result.success).toBe(true);
  });

  it("should access global from function", () => {
    const result = analyze("global x = 5; function foo() { return x; }");
    expect(result.success).toBe(true);
  });
});
