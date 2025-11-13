import {
  SymbolTable,
  Scope,
  SymbolKind,
} from "../src/compiler/semantic/SymbolTable";
import { Types } from "../src/compiler/types/Type";

describe("Symbol Table - Basic Operations", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should start in global scope", () => {
    expect(symbolTable.isGlobalScope()).toBe(true);
    expect(symbolTable.isInFunction()).toBe(false);
  });

  test("should declare variable in current scope", () => {
    const success = symbolTable.declareVariable("x", Types.INT, 1, 1);
    expect(success).toBe(true);
    expect(symbolTable.isDeclared("x")).toBe(true);
  });

  test("should not allow duplicate variable declaration", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1);
    const success = symbolTable.declareVariable("x", Types.STRING, 2, 1);
    expect(success).toBe(false);
  });

  test("should resolve variable", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false, true);
    const symbol = symbolTable.resolve("x");
    expect(symbol).toBeDefined();
    expect(symbol?.name).toBe("x");
    expect(symbol?.type).toBe(Types.INT);
    expect(symbol?.kind).toBe(SymbolKind.VARIABLE);
  });

  test("should return undefined for undeclared variable", () => {
    const symbol = symbolTable.resolve("undeclared");
    expect(symbol).toBeUndefined();
  });
});

describe("Symbol Table - Scopes", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should enter and exit scopes", () => {
    expect(symbolTable.isGlobalScope()).toBe(true);

    symbolTable.enterScope("block");
    expect(symbolTable.isGlobalScope()).toBe(false);

    symbolTable.exitScope();
    expect(symbolTable.isGlobalScope()).toBe(true);
  });

  test("should not allow exiting global scope", () => {
    expect(() => symbolTable.exitScope()).toThrow("Cannot exit global scope");
  });

  test("should track function scopes", () => {
    expect(symbolTable.isInFunction()).toBe(false);

    symbolTable.enterScope("function");
    expect(symbolTable.isInFunction()).toBe(true);

    symbolTable.enterScope("block");
    expect(symbolTable.isInFunction()).toBe(true);

    symbolTable.exitScope();
    symbolTable.exitScope();
    expect(symbolTable.isInFunction()).toBe(false);
  });

  test("should shadow variables in nested scopes", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1);

    symbolTable.enterScope("block");
    symbolTable.declareVariable("x", Types.STRING, 2, 1);

    const symbol = symbolTable.resolve("x");
    expect(symbol?.type).toBe(Types.STRING); // Inner scope shadows outer

    symbolTable.exitScope();
    const outerSymbol = symbolTable.resolve("x");
    expect(outerSymbol?.type).toBe(Types.INT); // Back to outer scope
  });

  test("should resolve variables from parent scopes", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1);

    symbolTable.enterScope("block");
    const symbol = symbolTable.resolve("x");
    expect(symbol).toBeDefined();
    expect(symbol?.type).toBe(Types.INT);

    symbolTable.exitScope();
  });

  test("should only lookup in current scope", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1);

    symbolTable.enterScope("block");
    const localSymbol = symbolTable.lookup("x");
    expect(localSymbol).toBeUndefined(); // lookup doesn't search parent

    const resolvedSymbol = symbolTable.resolve("x");
    expect(resolvedSymbol).toBeDefined(); // resolve searches parent

    symbolTable.exitScope();
  });
});

describe("Symbol Table - Global Variables", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should declare global variable", () => {
    const success = symbolTable.declareGlobal("g", Types.INT, 1, 1);
    expect(success).toBe(true);

    const symbol = symbolTable.resolve("g");
    expect(symbol?.kind).toBe(SymbolKind.GLOBAL);
  });

  test("should access global from nested scope", () => {
    symbolTable.declareGlobal("g", Types.INT, 1, 1);

    symbolTable.enterScope("function");
    symbolTable.enterScope("block");

    const symbol = symbolTable.resolve("g");
    expect(symbol).toBeDefined();
    expect(symbol?.kind).toBe(SymbolKind.GLOBAL);

    symbolTable.exitScope();
    symbolTable.exitScope();
  });
});

describe("Symbol Table - Functions", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should declare function", () => {
    const funcType = Types.function(Types.INT, Types.STRING);
    const success = symbolTable.declareFunction("myFunc", funcType, 1, 1);
    expect(success).toBe(true);

    const symbol = symbolTable.resolve("myFunc");
    expect(symbol?.kind).toBe(SymbolKind.FUNCTION);
    expect(symbol?.type).toBe(funcType);
  });

  test("should declare parameters in function scope", () => {
    symbolTable.enterScope("function");

    symbolTable.declareParameter("param1", Types.INT, 1, 5);
    symbolTable.declareParameter("param2", Types.STRING, 1, 12);

    const param1 = symbolTable.resolve("param1");
    const param2 = symbolTable.resolve("param2");

    expect(param1?.kind).toBe(SymbolKind.PARAMETER);
    expect(param2?.kind).toBe(SymbolKind.PARAMETER);
    expect(param1?.initialized).toBe(true); // Parameters are always initialized

    symbolTable.exitScope();
  });

  test("should not access parameters outside function scope", () => {
    symbolTable.enterScope("function");
    symbolTable.declareParameter("param", Types.INT, 1, 1);
    symbolTable.exitScope();

    const symbol = symbolTable.resolve("param");
    expect(symbol).toBeUndefined();
  });
});

describe("Symbol Table - Classes", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should declare class", () => {
    const classType = Types.ANY; // Simplified for test
    const success = symbolTable.declareClass("MyClass", classType, 1, 1);
    expect(success).toBe(true);

    const symbol = symbolTable.resolve("MyClass");
    expect(symbol?.kind).toBe(SymbolKind.CLASS);
  });

  test("should have class scope", () => {
    symbolTable.enterScope("class");
    expect(symbolTable.getCurrentScope().kind).toBe("class");
    symbolTable.exitScope();
  });
});

describe("Symbol Table - Initialization Tracking", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should track uninitialized variables", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false, false);
    expect(symbolTable.isDefined("x")).toBe(false);
  });

  test("should track initialized variables", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false, true);
    expect(symbolTable.isDefined("x")).toBe(true);
  });

  test("should mark variable as initialized", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false, false);
    expect(symbolTable.isDefined("x")).toBe(false);

    symbolTable.markInitialized("x");
    expect(symbolTable.isDefined("x")).toBe(true);
  });

  test("should mark variable from parent scope as initialized", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false, false);

    symbolTable.enterScope("block");
    symbolTable.markInitialized("x");
    symbolTable.exitScope();

    expect(symbolTable.isDefined("x")).toBe(true);
  });
});

describe("Symbol Table - Constant Variables", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should declare constant variable", () => {
    symbolTable.declareVariable("PI", Types.REAL, 1, 1, true, true);
    const symbol = symbolTable.resolve("PI");
    expect(symbol?.constant).toBe(true);
  });

  test("should track constant flag", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1, false);
    const mutable = symbolTable.resolve("x");
    expect(mutable?.constant).toBe(false);

    symbolTable.declareVariable("y", Types.INT, 2, 1, true);
    const constant = symbolTable.resolve("y");
    expect(constant?.constant).toBe(true);
  });
});

describe("Symbol Table - Scope Information", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should get current scope", () => {
    const globalScope = symbolTable.getCurrentScope();
    expect(globalScope.kind).toBe("global");

    symbolTable.enterScope("function");
    const funcScope = symbolTable.getCurrentScope();
    expect(funcScope.kind).toBe("function");

    symbolTable.exitScope();
  });

  test("should get global scope", () => {
    const globalScope = symbolTable.getGlobalScope();
    expect(globalScope.kind).toBe("global");

    symbolTable.enterScope("function");
    const stillGlobalScope = symbolTable.getGlobalScope();
    expect(stillGlobalScope.kind).toBe("global");
    expect(stillGlobalScope).toBe(globalScope);

    symbolTable.exitScope();
  });

  test("should get nearest function scope", () => {
    expect(symbolTable.getNearestFunctionScope()).toBeNull();

    symbolTable.enterScope("function");
    const funcScope = symbolTable.getNearestFunctionScope();
    expect(funcScope?.kind).toBe("function");

    symbolTable.enterScope("block");
    symbolTable.enterScope("block");
    const stillFuncScope = symbolTable.getNearestFunctionScope();
    expect(stillFuncScope).toBe(funcScope);

    symbolTable.exitScope();
    symbolTable.exitScope();
    symbolTable.exitScope();
  });
});

describe("Symbol Table - Scope Methods", () => {
  let scope: Scope;

  beforeEach(() => {
    scope = new Scope(null, "global");
  });

  test("should get all symbols", () => {
    scope.declare({
      name: "x",
      kind: SymbolKind.VARIABLE,
      type: Types.INT,
      line: 1,
      column: 1,
    });
    scope.declare({
      name: "y",
      kind: SymbolKind.VARIABLE,
      type: Types.STRING,
      line: 2,
      column: 1,
    });

    const symbols = scope.getSymbols();
    expect(symbols.length).toBe(2);
    expect(symbols.some((s) => s.name === "x")).toBe(true);
    expect(symbols.some((s) => s.name === "y")).toBe(true);
  });

  test("should get all symbol names", () => {
    scope.declare({
      name: "x",
      kind: SymbolKind.VARIABLE,
      type: Types.INT,
      line: 1,
      column: 1,
    });
    scope.declare({
      name: "y",
      kind: SymbolKind.VARIABLE,
      type: Types.STRING,
      line: 2,
      column: 1,
    });

    const names = scope.getNames();
    expect(names).toContain("x");
    expect(names).toContain("y");
    expect(names.length).toBe(2);
  });

  test("should update symbol type", () => {
    scope.declare({
      name: "x",
      kind: SymbolKind.VARIABLE,
      type: Types.INT,
      line: 1,
      column: 1,
    });

    const success = scope.updateType("x", Types.STRING);
    expect(success).toBe(true);

    const symbol = scope.lookup("x");
    expect(symbol?.type).toBe(Types.STRING);
  });

  test("should fail to update non-existent symbol", () => {
    const success = scope.updateType("nonexistent", Types.INT);
    expect(success).toBe(false);
  });
});

describe("Symbol Table - Reset", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  test("should reset symbol table", () => {
    symbolTable.declareVariable("x", Types.INT, 1, 1);
    symbolTable.enterScope("function");
    symbolTable.declareVariable("y", Types.STRING, 2, 1);

    symbolTable.reset();

    expect(symbolTable.isGlobalScope()).toBe(true);
    expect(symbolTable.resolve("x")).toBeUndefined();
    expect(symbolTable.resolve("y")).toBeUndefined();
  });
});
