/**
 * Type system for LeekScript
 * Ported from Java Type.java
 */

/**
 * Cast type - how compatible two types are
 */
export enum CastType {
  EQUALS = 0, // Exact same type
  UPCAST = 1, // Safe upcast (e.g., int -> any)
  SAFE_DOWNCAST = 2, // Safe downcast (e.g., int -> real)
  UNSAFE_DOWNCAST = 3, // Potentially unsafe downcast
  INCOMPATIBLE = 4, // Types are incompatible
}

/**
 * Base Type class
 */
export class Type {
  // Primitive types
  static readonly ERROR = new Type("error", "e", "Object", "Object", "null");
  static readonly WARNING = new Type(
    "warning",
    "w",
    "Object",
    "Object",
    "null"
  );
  static readonly VOID = new Type("void", "v", "Object", "Object", "null");
  static readonly ANY = new Type("any", "x", "Object", "Object", "null");
  static readonly NULL = new Type("null", "u", "Object", "Object", "null");
  static readonly BOOL = new Type(
    "boolean",
    "b",
    "boolean",
    "Boolean",
    "false"
  );
  static readonly INT = new Type("integer", "i", "number", "Number", "0");
  static readonly REAL = new Type("real", "r", "number", "Number", "0.0");
  static readonly STRING = new Type("string", "s", "string", "String", '""');

  // Complex types (will be initialized after class definitions)
  static OBJECT: Type;
  static FUNCTION: Type;
  static ARRAY: Type;
  static EMPTY_ARRAY: Type;
  static MAP: Type;
  static EMPTY_MAP: Type;
  static SET: Type;
  static EMPTY_SET: Type;
  static CLASS: Type;

  // Compound types
  static INT_OR_NULL: Type;
  static BOOL_OR_NULL: Type;
  static STRING_OR_NULL: Type;
  static INT_OR_REAL: Type;

  name: string;
  signature: string;
  private javaPrimitiveName: string;
  private javaName: string;
  private defaultValue: string;

  constructor(
    name: string,
    signature: string,
    javaPrimitiveName: string,
    javaName: string,
    defaultValue: string
  ) {
    this.name = name;
    this.signature = signature;
    this.javaPrimitiveName = javaPrimitiveName;
    this.javaName = javaName;
    this.defaultValue = defaultValue;
  }

  /**
   * Check if this type accepts another type
   * Returns how compatible they are
   */
  accepts(type: Type): CastType {
    // Same type
    if (type === this) {
      return CastType.EQUALS;
    }

    // ANY accepts everything
    if (this === Type.ANY) {
      return CastType.UPCAST;
    }

    // Everything can be cast to ANY (unsafe)
    if (type === Type.ANY) {
      return CastType.UNSAFE_DOWNCAST;
    }

    // Compound type handling
    if (type instanceof CompoundType) {
      let best = CastType.INCOMPATIBLE;
      let worst = CastType.EQUALS;

      for (const t of type.getTypes()) {
        const r = this.accepts(t);
        if (r > worst) worst = r;
        if (r < best) best = r;
      }

      // If at least one is compatible, the whole is compatible
      if (worst === CastType.INCOMPATIBLE && best !== CastType.INCOMPATIBLE) {
        return CastType.UNSAFE_DOWNCAST;
      }

      return worst;
    }

    // Number conversions
    if (this === Type.REAL && type === Type.INT) {
      return CastType.SAFE_DOWNCAST;
    }
    if (this === Type.INT && type === Type.REAL) {
      return CastType.SAFE_DOWNCAST;
    }

    // Function type can accept class values
    if (this === Type.FUNCTION && type instanceof ClassValueType) {
      return CastType.UPCAST;
    }

    return CastType.INCOMPATIBLE;
  }

  /**
   * Check if this is a primitive number type
   */
  isPrimitiveNumber(): boolean {
    return this === Type.INT || this === Type.REAL;
  }

  /**
   * Check if this is a number type
   */
  isNumber(): boolean {
    return this === Type.INT || this === Type.REAL;
  }

  /**
   * Check if this is an array type
   */
  isArray(): boolean {
    return false;
  }

  /**
   * Check if this is an array or null
   */
  isArrayOrNull(): boolean {
    return false;
  }

  /**
   * Check if this is a map type
   */
  isMap(): boolean {
    return false;
  }

  /**
   * Union this type with another
   */
  union(type: Type): Type {
    if (this === Type.VOID) return type;
    if (type === Type.VOID) return this;
    return Type.ANY;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return this.name;
  }

  /**
   * Get type signature
   */
  getSignature(): string {
    return this.signature;
  }

  /**
   * Get Java primitive name
   */
  getJavaPrimitiveName(): string {
    return this.javaPrimitiveName;
  }

  /**
   * Get Java name
   */
  getJavaName(): string {
    return this.javaName;
  }

  /**
   * Get default value
   */
  getDefaultValue(): string {
    return this.defaultValue;
  }

  /**
   * Convert to JSON
   */
  toJSON(): any {
    return this.toString();
  }
}

/**
 * Compound type - union of multiple types
 * e.g., int|null
 */
export class CompoundType extends Type {
  private types: Set<Type>;

  constructor(types: Set<Type>) {
    const names = Array.from(types)
      .map((t) => t.name)
      .join("|");
    const sigs = Array.from(types)
      .map((t) => t.signature)
      .join("");
    super(names, sigs, "Object", "Object", "null");
    this.types = types;
  }

  getTypes(): Set<Type> {
    return this.types;
  }

  override accepts(type: Type): CastType {
    // Check if any of our types accepts the given type
    let best = CastType.INCOMPATIBLE;

    for (const t of this.types) {
      const cast = t.accepts(type);
      if (cast < best) {
        best = cast;
      }
    }

    return best;
  }

  override toString(): string {
    return Array.from(this.types)
      .map((t) => t.toString())
      .join("|");
  }
}

/**
 * Array type
 */
export class ArrayType extends Type {
  private elementType: Type;

  constructor(elementType: Type) {
    super(
      `array<${elementType.name}>`,
      `a${elementType.signature}`,
      "Array",
      "Array",
      "[]"
    );
    this.elementType = elementType;
  }

  getElementType(): Type {
    return this.elementType;
  }

  override isArray(): boolean {
    return true;
  }

  override accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type instanceof ArrayType) {
      // Array covariance
      return this.elementType.accepts(type.elementType);
    }
    return super.accepts(type);
  }
}

/**
 * Map type
 */
export class MapType extends Type {
  private keyType: Type;
  private valueType: Type;

  constructor(keyType: Type, valueType: Type) {
    super(
      `map<${keyType.name}, ${valueType.name}>`,
      `m${keyType.signature}${valueType.signature}`,
      "Map",
      "Map",
      "new Map()"
    );
    this.keyType = keyType;
    this.valueType = valueType;
  }

  getKeyType(): Type {
    return this.keyType;
  }

  getValueType(): Type {
    return this.valueType;
  }

  override isMap(): boolean {
    return true;
  }
}

/**
 * Function type
 */
export class FunctionType extends Type {
  private returnType: Type;
  private argumentTypes: Type[];

  constructor(returnType: Type, argumentTypes: Type[] = []) {
    super("function", "f", "Function", "Function", "null");
    this.returnType = returnType;
    this.argumentTypes = argumentTypes;
  }

  getReturnType(): Type {
    return this.returnType;
  }

  getArgumentTypes(): Type[] {
    return this.argumentTypes;
  }
}

/**
 * Class value type (for class references)
 */
export class ClassValueType extends Type {
  private classDeclaration: any; // ClassDeclarationInstruction

  constructor(classDeclaration: any) {
    super("class", "c", "Class", "Class", "null");
    this.classDeclaration = classDeclaration;
  }

  getClassDeclaration(): any {
    return this.classDeclaration;
  }
}

/**
 * Class instance type
 */
export class ClassType extends Type {
  private classDeclaration: any; // ClassDeclarationInstruction

  constructor(classDeclaration: any) {
    const name = classDeclaration?.getName() || "object";
    super(name, "o", "Object", "Object", "null");
    this.classDeclaration = classDeclaration;
  }

  getClassDeclaration(): any {
    return this.classDeclaration;
  }
}

/**
 * Object type
 */
export class ObjectType extends Type {
  constructor() {
    super("object", "o", "Object", "Object", "{}");
  }
}

/**
 * Set type
 */
export class SetType extends Type {
  private elementType: Type;

  constructor(elementType: Type) {
    super(
      `set<${elementType.name}>`,
      `S${elementType.signature}`,
      "Set",
      "Set",
      "new Set()"
    );
    this.elementType = elementType;
  }

  getElementType(): Type {
    return this.elementType;
  }
}

/**
 * Interval type
 */
export class IntervalType extends Type {
  private elementType: Type;

  constructor(elementType: Type) {
    super(
      `interval<${elementType.name}>`,
      `I${elementType.signature}`,
      "Interval",
      "Interval",
      "null"
    );
    this.elementType = elementType;
  }

  getElementType(): Type {
    return this.elementType;
  }
}

// Initialize complex types
Type.OBJECT = new ObjectType();
Type.FUNCTION = new FunctionType(Type.ANY);
Type.ARRAY = new ArrayType(Type.ANY);
Type.EMPTY_ARRAY = new ArrayType(Type.VOID);
Type.MAP = new MapType(Type.ANY, Type.ANY);
Type.EMPTY_MAP = new MapType(Type.VOID, Type.VOID);
Type.SET = new SetType(Type.ANY);
Type.EMPTY_SET = new SetType(Type.VOID);
Type.CLASS = new ClassValueType(null);

// Compound types
Type.INT_OR_NULL = compound(Type.INT, Type.NULL);
Type.BOOL_OR_NULL = compound(Type.BOOL, Type.NULL);
Type.STRING_OR_NULL = compound(Type.STRING, Type.NULL);
Type.INT_OR_REAL = compound(Type.INT, Type.REAL);

/**
 * Helper functions
 */

/**
 * Create array type
 */
export function array(elementType: Type): ArrayType {
  return new ArrayType(elementType);
}

/**
 * Create map type
 */
export function map(keyType: Type, valueType: Type): MapType {
  return new MapType(keyType, valueType);
}

/**
 * Create set type
 */
export function set(elementType: Type): SetType {
  return new SetType(elementType);
}

/**
 * Create compound type from multiple types
 */
export function compound(...types: Type[]): CompoundType {
  const typeSet = new Set<Type>();

  for (const t of types) {
    if (t instanceof CompoundType) {
      // Flatten compound types
      for (const inner of t.getTypes()) {
        if (inner !== Type.VOID) {
          typeSet.add(inner);
        }
      }
    } else if (t !== Type.VOID) {
      typeSet.add(t);
    }
  }

  if (typeSet.size === 0) return Type.VOID as any;
  if (typeSet.size === 1) return Array.from(typeSet)[0] as any;

  return new CompoundType(typeSet);
}

/**
 * Union multiple types
 */
export function unionTypes(types: Type[]): Type {
  if (types.length === 0) return Type.VOID;

  let result = types[0];
  for (let i = 1; i < types.length; i++) {
    result = result.union(types[i]);
  }
  return result;
}
