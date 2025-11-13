import { describe, expect, it } from "@jest/globals";
import { Parser } from "../src";

/**
 * Integration tests ported from Java test suite
 * These tests verify that the parser can successfully parse valid LeekScript code
 */

function parse(code: string) {
  try {
    const parser = new Parser(code);
    const ast = parser.parse();
    return { success: true, ast };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describe("Integration - General (from TestGeneral.java)", () => {
  it("should parse null literals", () => {
    expect(parse("return null").success).toBe(true);
    expect(parse("return Null").success).toBe(true);
    expect(parse("return NULL").success).toBe(true);
  });

  it("should parse variable declarations", () => {
    expect(parse("var a").success).toBe(true);
    expect(parse("var a = 2").success).toBe(true);
    expect(parse("var a = 2 return a").success).toBe(true);
    expect(parse("var a, b, c = 3 return c").success).toBe(true);
    expect(parse("var a = 1, b = 2, c = 3 return c").success).toBe(true);
  });

  it("should parse variable assignment", () => {
    expect(parse("var a a = 12 return a").success).toBe(true);
    expect(parse("var a = 5 a = 13 return a").success).toBe(true);
    expect(parse("var a = 1 var b = (a = 12) return b").success).toBe(true);
  });

  it("should parse string variables", () => {
    expect(parse("var s = 'hello' return s").success).toBe(true);
  });

  it("should parse assignment in expressions", () => {
    expect(parse("var a = 2 return [a = 10]").success).toBe(true);
    expect(parse("var a = 2 return ['a', a = 10]").success).toBe(true);
  });

  it("should parse function calls", () => {
    expect(parse("return typeOf(255)").success).toBe(true);
    expect(parse("return typeOf(255.8)").success).toBe(true);
    expect(parse("return typeOf('coucou')").success).toBe(true);
    expect(parse("return typeOf(false)").success).toBe(true);
    expect(parse("return typeOf([1,false])").success).toBe(true);
    expect(parse("return typeOf(function(){ return null; })").success).toBe(
      true
    );
    expect(parse("return typeOf(null)").success).toBe(true);
    expect(parse("return typeOf(function(){ return 4; }())").success).toBe(
      true
    );
  });

  it("should parse color functions", () => {
    expect(parse("return getColor(255,0,255)").success).toBe(true);
    expect(parse("return getColor(255,255,0)").success).toBe(true);
    expect(parse("return getColor(0,255,255)").success).toBe(true);
    expect(parse("return getRed(11403264)").success).toBe(true);
    expect(parse("return getGreen(44800)").success).toBe(true);
    expect(parse("return getBlue(173)").success).toBe(true);
  });
});

describe("Integration - Numbers (from TestNumber.java)", () => {
  it("should parse basic numbers", () => {
    expect(parse("return 0").success).toBe(true);
    expect(parse("return -1").success).toBe(true);
    expect(parse("return -(-1)").success).toBe(true);
    expect(parse("return -1e3").success).toBe(true);
    expect(parse("return 1e-3").success).toBe(true);
    expect(parse("return 1e-3+5").success).toBe(true);
    expect(parse("return 1e+3").success).toBe(true);
    expect(parse("return 1e+3+2").success).toBe(true);
    expect(parse("return 1e+3-2").success).toBe(true);
    expect(parse("return 1.5e-3").success).toBe(true);
  });

  it("should parse special characters", () => {
    expect(parse("return π").success).toBe(true);
    expect(parse("return ∞").success).toBe(true);
    expect(parse("return -∞").success).toBe(true);
  });

  it("should parse hexadecimal numbers", () => {
    expect(parse("return 0x0").success).toBe(true);
    expect(parse("return 0x00000000").success).toBe(true);
    expect(parse("return 0x1").success).toBe(true);
    expect(parse("return 0x00000001").success).toBe(true);
    expect(parse("return 0xf").success).toBe(true);
    expect(parse("return 0x0000000f").success).toBe(true);
    expect(parse("return -0xf").success).toBe(true);
    expect(parse("return 0xff").success).toBe(true);
    expect(parse("return 0xFFFFFFFF").success).toBe(true);
  });

  it("should parse binary numbers", () => {
    expect(parse("return 0b0").success).toBe(true);
    expect(parse("return 0b1").success).toBe(true);
    expect(parse("return 0b101").success).toBe(true);
    expect(parse("return 0b11111111").success).toBe(true);
  });

  it("should parse basic arithmetic", () => {
    expect(parse("return 0 + 5").success).toBe(true);
    expect(parse("return 5 + 5").success).toBe(true);
    expect(parse("return 10 - 3").success).toBe(true);
    expect(parse("return -2 + 3").success).toBe(true);
    expect(parse("return 5 * 5").success).toBe(true);
    expect(parse("return 15 / 3").success).toBe(true);
    expect(parse("return 15 / 2").success).toBe(true);
    expect(parse("return 12 ** 2").success).toBe(true);
    expect(parse("return 2 ** 5").success).toBe(true);
  });

  it("should parse comparisons", () => {
    expect(parse("return 2 < 5").success).toBe(true);
    expect(parse("return 12 < 5").success).toBe(true);
    expect(parse("return 5 == 12").success).toBe(true);
    expect(parse("return 12 == 12").success).toBe(true);
  });

  it("should parse float arithmetic", () => {
    expect(parse("return 0.2 + 0.1").success).toBe(true);
    expect(parse("return -12 * 2").success).toBe(true);
    expect(parse("return (-12) * 2").success).toBe(true);
    expect(parse("return -12 ** 2").success).toBe(true);
    expect(parse("return (-12) ** 2").success).toBe(true);
    expect(parse("return -12 + 2").success).toBe(true);
  });

  it("should parse complex expressions", () => {
    expect(
      parse("var a = [2, 'a'] return [-a[0], ~a[0]] == [-2, ~2]").success
    ).toBe(true);
  });
});

describe("Integration - Operators (from TestOperators.java)", () => {
  it("should parse equality operators", () => {
    expect(parse("return null == null").success).toBe(true);
    expect(parse("return false == false").success).toBe(true);
    expect(parse("return true == true").success).toBe(true);
    expect(parse("return false == true").success).toBe(true);
    expect(parse("return true == false").success).toBe(true);
  });

  it("should parse mixed type comparisons", () => {
    expect(parse("return true == 'true'").success).toBe(true);
    expect(parse("return false == 'false'").success).toBe(true);
    expect(parse("return true == 12").success).toBe(true);
    expect(parse("return true == '1'").success).toBe(true);
    expect(parse("return true == '12'").success).toBe(true);
    expect(parse("return true == [1]").success).toBe(true);
    expect(parse("return true == [12]").success).toBe(true);
    expect(parse("return true == [1, 2, 3]").success).toBe(true);
  });

  it("should parse number comparisons", () => {
    expect(parse("return 0 == false").success).toBe(true);
    expect(parse("return 0 == 0").success).toBe(true);
    expect(parse("return 0 == ''").success).toBe(true);
    expect(parse("return 0 == '0'").success).toBe(true);
    expect(parse("return 0 == []").success).toBe(true);
    expect(parse("return 0 == [0]").success).toBe(true);
    expect(parse("return 0 != null").success).toBe(true);
  });

  it("should parse inequality operators", () => {
    expect(parse("return false != 0").success).toBe(true);
    expect(parse("return true != 1").success).toBe(true);
  });

  it("should parse logical operators", () => {
    expect(parse("return true && false").success).toBe(true);
    expect(parse("return true || false").success).toBe(true);
    expect(parse("return !true").success).toBe(true);
    expect(parse("return true and false").success).toBe(true);
    expect(parse("return true or false").success).toBe(true);
    expect(parse("return not true").success).toBe(true);
  });

  it("should parse bitwise operators", () => {
    expect(parse("return 5 & 3").success).toBe(true);
    expect(parse("return 5 | 3").success).toBe(true);
    expect(parse("return 5 ^ 3").success).toBe(true);
    expect(parse("return ~5").success).toBe(true);
    expect(parse("return 5 << 2").success).toBe(true);
    expect(parse("return 5 >> 2").success).toBe(true);
    expect(parse("return 5 >>> 2").success).toBe(true);
  });
});

describe("Integration - Strings (from TestString.java)", () => {
  it("should parse string literals", () => {
    expect(parse("return 'hello'").success).toBe(true);
    expect(parse('return "hello"').success).toBe(true);
    expect(parse("return ''").success).toBe(true);
    expect(parse('return ""').success).toBe(true);
  });

  it("should parse string concatenation", () => {
    expect(parse("return 'hello' + 'world'").success).toBe(true);
    expect(parse("return 'hello' + ' ' + 'world'").success).toBe(true);
  });

  it("should parse escaped characters", () => {
    expect(parse("return 'hello\\'world'").success).toBe(true);
    expect(parse('return "hello\\"world"').success).toBe(true);
    expect(parse("return 'hello\\nworld'").success).toBe(true);
    expect(parse("return 'hello\\tworld'").success).toBe(true);
  });

  it("should parse string methods", () => {
    expect(parse("return 'hello'.length").success).toBe(true);
    expect(parse("return 'hello'.charAt(0)").success).toBe(true);
    expect(parse("return 'hello'.substring(0, 2)").success).toBe(true);
  });
});

describe("Integration - Arrays (from TestArray.java)", () => {
  it("should parse array literals", () => {
    expect(parse("return []").success).toBe(true);
    expect(parse("return [1]").success).toBe(true);
    expect(parse("return [1, 2, 3]").success).toBe(true);
    expect(parse("return [1, 2, 3, 4, 5]").success).toBe(true);
  });

  it("should parse nested arrays", () => {
    expect(parse("return [[]]").success).toBe(true);
    expect(parse("return [[1]]").success).toBe(true);
    expect(parse("return [[1, 2], [3, 4]]").success).toBe(true);
    expect(parse("return [[[1]]]").success).toBe(true);
  });

  it("should parse array access", () => {
    expect(parse("var a = [1, 2, 3] return a[0]").success).toBe(true);
    expect(parse("var a = [1, 2, 3] return a[1]").success).toBe(true);
    expect(parse("var a = [1, 2, 3] return a[a[0]]").success).toBe(true);
  });

  it("should parse array assignment", () => {
    expect(parse("var a = [1, 2, 3] a[0] = 5").success).toBe(true);
    expect(parse("var a = [1, 2, 3] a[1] = a[0]").success).toBe(true);
  });

  it("should parse mixed type arrays", () => {
    expect(parse("return [1, 'hello', true]").success).toBe(true);
    expect(parse("return [1, [2, 3], 'hello']").success).toBe(true);
  });
});

describe("Integration - Functions (from TestFunction.java)", () => {
  it("should parse function declarations", () => {
    expect(parse("function foo() {}").success).toBe(true);
    expect(parse("function foo() { return 5; }").success).toBe(true);
    expect(parse("function foo(x) { return x; }").success).toBe(true);
    expect(parse("function foo(x, y) { return x + y; }").success).toBe(true);
  });

  it("should parse function expressions", () => {
    expect(parse("var f = function() {}").success).toBe(true);
    expect(parse("var f = function() { return 5; }").success).toBe(true);
    expect(parse("var f = function(x) { return x; }").success).toBe(true);
  });

  it("should parse function calls", () => {
    expect(parse("function foo() {} foo()").success).toBe(true);
    expect(parse("function foo(x) {} foo(5)").success).toBe(true);
    expect(parse("function foo(x, y) {} foo(1, 2)").success).toBe(true);
  });

  it("should parse anonymous functions", () => {
    expect(parse("(function() {})()").success).toBe(true);
    expect(parse("(function(x) { return x; })(5)").success).toBe(true);
  });

  it("should parse nested functions", () => {
    expect(parse("function outer() { function inner() {} }").success).toBe(
      true
    );
    expect(parse("function outer() { return function() {}; }").success).toBe(
      true
    );
  });
});

describe("Integration - Control Flow (from TestIf.java, TestLoops.java)", () => {
  it("should parse if statements", () => {
    expect(parse("if (true) {}").success).toBe(true);
    expect(parse("if (true) { var x = 5; }").success).toBe(true);
    expect(parse("if (true) {} else {}").success).toBe(true);
    expect(parse("if (true) { return 1; } else { return 2; }").success).toBe(
      true
    );
  });

  it("should parse while loops", () => {
    expect(parse("while (true) {}").success).toBe(true);
    expect(parse("while (true) { break; }").success).toBe(true);
    expect(parse("while (true) { continue; }").success).toBe(true);
  });

  it("should parse for loops", () => {
    expect(parse("for (var i = 0; i < 10; i++) {}").success).toBe(true);
    expect(parse("for (var i = 0; i < 10; i++) { var x = i; }").success).toBe(
      true
    );
    expect(parse("for (;;) {}").success).toBe(true);
  });

  it("should parse do-while loops", () => {
    expect(parse("do {} while (true)").success).toBe(true);
    expect(parse("do { var x = 5; } while (true)").success).toBe(true);
  });

  it("should parse break and continue", () => {
    expect(parse("while (true) { break; }").success).toBe(true);
    expect(parse("while (true) { continue; }").success).toBe(true);
    expect(
      parse("for (var i = 0; i < 10; i++) { if (i == 5) break; }").success
    ).toBe(true);
  });
});

describe("Integration - Classes (from TestClass.java)", () => {
  it("should parse empty classes", () => {
    expect(parse("class Foo {}").success).toBe(true);
  });

  it("should parse classes with methods", () => {
    expect(parse("class Foo { function bar() {} }").success).toBe(true);
    expect(parse("class Foo { function bar() { return 5; } }").success).toBe(
      true
    );
  });

  it("should parse classes with multiple methods", () => {
    expect(
      parse("class Foo { function bar() {} function baz() {} }").success
    ).toBe(true);
  });

  it("should parse class inheritance", () => {
    expect(parse("class Bar {} class Foo extends Bar {}").success).toBe(true);
  });
});

describe("Integration - Complex Programs", () => {
  it("should parse fibonacci function", () => {
    const result = parse(`
      function fib(n) {
        if (n <= 1) {
          return n;
        }
        return fib(n - 1) + fib(n - 2);
      }
      return fib(10);
    `);
    expect(result.success).toBe(true);
  });

  it("should parse factorial function", () => {
    const result = parse(`
      function fact(n) {
        if (n <= 1) {
          return 1;
        }
        return n * fact(n - 1);
      }
      return fact(5);
    `);
    expect(result.success).toBe(true);
  });

  it("should parse array sorting", () => {
    const result = parse(`
      var arr = [3, 1, 4, 1, 5, 9, 2, 6];
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          if (arr[i] > arr[j]) {
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
          }
        }
      }
      return arr;
    `);
    expect(result.success).toBe(true);
  });

  it("should parse nested loops and conditions", () => {
    const result = parse(`
      var result = 0;
      for (var i = 0; i < 10; i++) {
        if (i % 2 == 0) {
          for (var j = 0; j < i; j++) {
            result += j;
          }
        } else {
          result += i;
        }
      }
      return result;
    `);
    expect(result.success).toBe(true);
  });
});
