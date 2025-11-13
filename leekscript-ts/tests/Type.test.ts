import {
  Type,
  Types,
  CastType,
  PrimitiveType,
  CompoundType,
  ArrayType,
  MapType,
  FunctionType,
  ClassType,
} from "../src/compiler/types/Type";

describe("Type System - Primitive Types", () => {
  test("should have basic primitive types", () => {
    expect(Types.VOID.name).toBe("void");
    expect(Types.ANY.name).toBe("any");
    expect(Types.NULL.name).toBe("null");
    expect(Types.BOOL.name).toBe("boolean");
    expect(Types.INT.name).toBe("integer");
    expect(Types.REAL.name).toBe("real");
    expect(Types.STRING.name).toBe("string");
  });

  test("should identify primitive types", () => {
    expect(Types.INT.isPrimitive()).toBe(true);
    expect(Types.STRING.isPrimitive()).toBe(true);
    expect(Types.BOOL.isPrimitive()).toBe(true);
  });

  test("should identify numeric types", () => {
    expect(Types.INT.isNumeric()).toBe(true);
    expect(Types.REAL.isNumeric()).toBe(true);
    expect(Types.STRING.isNumeric()).toBe(false);
    expect(Types.BOOL.isNumeric()).toBe(false);
  });

  test("should accept same type with EQUALS cast", () => {
    expect(Types.INT.accepts(Types.INT)).toBe(CastType.EQUALS);
    expect(Types.STRING.accepts(Types.STRING)).toBe(CastType.EQUALS);
  });

  test("should accept ANY with UNSAFE_DOWNCAST", () => {
    expect(Types.INT.accepts(Types.ANY)).toBe(CastType.UNSAFE_DOWNCAST);
    expect(Types.STRING.accepts(Types.ANY)).toBe(CastType.UNSAFE_DOWNCAST);
  });

  test("ANY should accept all types with UPCAST", () => {
    expect(Types.ANY.accepts(Types.INT)).toBe(CastType.UPCAST);
    expect(Types.ANY.accepts(Types.STRING)).toBe(CastType.UPCAST);
    expect(Types.ANY.accepts(Types.BOOL)).toBe(CastType.UPCAST);
  });

  test("should reject incompatible primitive types", () => {
    expect(Types.INT.accepts(Types.STRING)).toBe(CastType.INCOMPATIBLE);
    expect(Types.STRING.accepts(Types.BOOL)).toBe(CastType.INCOMPATIBLE);
  });
});

describe("Type System - Compound Types", () => {
  test("should create compound type", () => {
    const intOrString = Types.compound(Types.INT, Types.STRING);
    expect(intOrString.isCompound()).toBe(true);
    expect(intOrString.name).toBe("integer | string");
  });

  test("should flatten nested compound types", () => {
    const intOrString = Types.compound(Types.INT, Types.STRING);
    const intOrStringOrBool = Types.compound(intOrString, Types.BOOL);
    expect((intOrStringOrBool as CompoundType).types.length).toBe(3);
  });

  test("should remove duplicate types", () => {
    const compound = Types.compound(Types.INT, Types.INT, Types.STRING);
    expect((compound as CompoundType).types.length).toBe(2);
  });

  test("should cache compound types", () => {
    const c1 = Types.compound(Types.INT, Types.STRING);
    const c2 = Types.compound(Types.INT, Types.STRING);
    expect(c1).toBe(c2);
  });

  test("should accept component types", () => {
    const intOrString = Types.compound(Types.INT, Types.STRING);
    expect(intOrString.accepts(Types.INT)).toBeLessThanOrEqual(CastType.UPCAST);
    expect(intOrString.accepts(Types.STRING)).toBeLessThanOrEqual(
      CastType.UPCAST
    );
  });

  test("should check compound type equality", () => {
    const c1 = Types.compound(Types.INT, Types.STRING);
    const c2 = Types.compound(Types.STRING, Types.INT); // Order shouldn't matter
    expect(c1.equals(c2)).toBe(true);
  });

  test("INT_OR_NULL predefined type", () => {
    expect(Types.INT_OR_NULL.isCompound()).toBe(true);
    expect((Types.INT_OR_NULL as CompoundType).hasType(Types.INT)).toBe(true);
    expect((Types.INT_OR_NULL as CompoundType).hasType(Types.NULL)).toBe(true);
  });
});

describe("Type System - Array Types", () => {
  test("should create array type", () => {
    const intArray = Types.array(Types.INT);
    expect(intArray.isArray()).toBe(true);
    expect(intArray.name).toBe("array<integer>");
    expect(intArray.elementType).toBe(Types.INT);
  });

  test("should cache array types", () => {
    const a1 = Types.array(Types.INT);
    const a2 = Types.array(Types.INT);
    expect(a1).toBe(a2);
  });

  test("should accept same element type with EQUALS", () => {
    const intArray = Types.array(Types.INT);
    expect(intArray.accepts(intArray)).toBe(CastType.EQUALS);
  });

  test("should accept array of ANY element type", () => {
    const intArray = Types.array(Types.INT);
    const anyArray = Types.array(Types.ANY);
    expect(anyArray.accepts(intArray)).toBe(CastType.UPCAST);
  });

  test("should check array type equality", () => {
    const a1 = Types.array(Types.INT);
    const a2 = Types.array(Types.INT);
    const a3 = Types.array(Types.STRING);
    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(a3)).toBe(false);
  });

  test("predefined array types", () => {
    expect(Types.ARRAY_INT.elementType).toBe(Types.INT);
    expect(Types.ARRAY_STRING.elementType).toBe(Types.STRING);
    expect(Types.ARRAY_REAL.elementType).toBe(Types.REAL);
  });

  test("should compute LUB of array types", () => {
    const intArray = Types.array(Types.INT);
    const realArray = Types.array(Types.REAL);
    const lub = intArray.getLeastUpperBound(realArray);
    expect(lub).toBeInstanceOf(ArrayType);
    // LUB of INT and REAL is REAL (numeric promotion)
    expect((lub as ArrayType).elementType).toBe(Types.REAL);
  });
});

describe("Type System - Map Types", () => {
  test("should create map type", () => {
    const stringToInt = Types.map(Types.STRING, Types.INT);
    expect(stringToInt.name).toBe("map<string, integer>");
    expect(stringToInt.keyType).toBe(Types.STRING);
    expect(stringToInt.valueType).toBe(Types.INT);
  });

  test("should cache map types", () => {
    const m1 = Types.map(Types.STRING, Types.INT);
    const m2 = Types.map(Types.STRING, Types.INT);
    expect(m1).toBe(m2);
  });

  test("should accept same key/value types with EQUALS", () => {
    const stringToInt = Types.map(Types.STRING, Types.INT);
    expect(stringToInt.accepts(stringToInt)).toBe(CastType.EQUALS);
  });

  test("should check map type equality", () => {
    const m1 = Types.map(Types.STRING, Types.INT);
    const m2 = Types.map(Types.STRING, Types.INT);
    const m3 = Types.map(Types.INT, Types.STRING);
    expect(m1.equals(m2)).toBe(true);
    expect(m1.equals(m3)).toBe(false);
  });
});

describe("Type System - Function Types", () => {
  test("should create function type", () => {
    const intToString = Types.function(Types.STRING, Types.INT);
    expect(intToString.isFunction()).toBe(true);
    expect(intToString.returnType).toBe(Types.STRING);
    expect(intToString.parameterTypes).toEqual([Types.INT]);
  });

  test("should cache function types", () => {
    const f1 = Types.function(Types.STRING, Types.INT);
    const f2 = Types.function(Types.STRING, Types.INT);
    expect(f1).toBe(f2);
  });

  test("should accept same signature with EQUALS", () => {
    const f1 = Types.function(Types.STRING, Types.INT);
    const f2 = Types.function(Types.STRING, Types.INT);
    // Function types are cached, so f1 === f2
    expect(f1.accepts(f2)).toBe(CastType.EQUALS);
  });

  test("should check function type equality", () => {
    const f1 = Types.function(Types.STRING, Types.INT);
    const f2 = Types.function(Types.STRING, Types.INT);
    const f3 = Types.function(Types.INT, Types.STRING);
    expect(f1.equals(f2)).toBe(true);
    expect(f1.equals(f3)).toBe(false);
  });

  test("should create function with multiple parameters", () => {
    const func = Types.function(Types.BOOL, Types.INT, Types.STRING);
    expect(func.parameterTypes).toEqual([Types.INT, Types.STRING]);
    expect(func.returnType).toBe(Types.BOOL);
  });
});

describe("Type System - Class Types", () => {
  test("should create class type", () => {
    const myClass = new ClassType("MyClass");
    expect(myClass.isClass()).toBe(true);
    expect(myClass.name).toBe("MyClass");
  });

  test("should add methods to class", () => {
    const myClass = new ClassType("MyClass");
    const method = Types.function(Types.VOID, Types.INT);
    myClass.methods.set("myMethod", method);

    expect(myClass.hasMethod("myMethod")).toBe(true);
    expect(myClass.getMethod("myMethod")).toBe(method);
  });

  test("should add fields to class", () => {
    const myClass = new ClassType("MyClass");
    myClass.fields.set("x", Types.INT);
    myClass.fields.set("name", Types.STRING);

    expect(myClass.hasField("x")).toBe(true);
    expect(myClass.getField("x")).toBe(Types.INT);
    expect(myClass.hasField("name")).toBe(true);
    expect(myClass.getField("name")).toBe(Types.STRING);
  });

  test("should accept same class with EQUALS", () => {
    const class1 = new ClassType("MyClass");
    expect(class1.accepts(class1)).toBe(CastType.EQUALS);
  });
});

describe("Type System - Type Operations", () => {
  test("getLeastUpperBound for primitives", () => {
    const lub = Types.INT.getLeastUpperBound(Types.STRING);
    expect(lub.isCompound()).toBe(true);
    expect((lub as CompoundType).hasType(Types.INT)).toBe(true);
    expect((lub as CompoundType).hasType(Types.STRING)).toBe(true);
  });

  test("getLeastUpperBound for numeric types", () => {
    const lub = Types.INT.getLeastUpperBound(Types.REAL);
    expect(lub).toBe(Types.REAL);
  });

  test("getLeastUpperBound for same type", () => {
    const lub = Types.INT.getLeastUpperBound(Types.INT);
    expect(lub).toBe(Types.INT);
  });

  test("getLeastUpperBound for multiple types", () => {
    const lub = Types.getLeastUpperBound(Types.INT, Types.STRING, Types.BOOL);
    expect(lub.isCompound()).toBe(true);
    expect((lub as CompoundType).types.length).toBe(3);
  });

  test("isAssignable helper", () => {
    expect(Types.isAssignable(Types.INT, Types.INT)).toBe(true);
    expect(Types.isAssignable(Types.ANY, Types.INT)).toBe(true);
    expect(Types.isAssignable(Types.INT, Types.STRING)).toBe(false);
  });

  test("isSafeCast helper", () => {
    expect(Types.isSafeCast(Types.INT, Types.INT)).toBe(true);
    expect(Types.isSafeCast(Types.ANY, Types.INT)).toBe(true);
    expect(Types.isSafeCast(Types.INT, Types.ANY)).toBe(false); // Unsafe downcast
  });
});

describe("Type System - toString", () => {
  test("primitive types toString", () => {
    expect(Types.INT.toString()).toBe("integer");
    expect(Types.STRING.toString()).toBe("string");
  });

  test("compound types toString", () => {
    const compound = Types.compound(Types.INT, Types.STRING);
    expect(compound.toString()).toContain("integer");
    expect(compound.toString()).toContain("string");
    expect(compound.toString()).toContain("|");
  });

  test("array types toString", () => {
    const intArray = Types.array(Types.INT);
    expect(intArray.toString()).toBe("array<integer>");
  });

  test("map types toString", () => {
    const stringToInt = Types.map(Types.STRING, Types.INT);
    expect(stringToInt.toString()).toBe("map<string, integer>");
  });
});
