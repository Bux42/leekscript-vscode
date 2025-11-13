/**
 * LeekScript Type System
 * Based on leekscript/common/Type.java
 */

export enum CastType {
  EQUALS = 0,
  UPCAST = 1,
  SAFE_DOWNCAST = 2,
  UNSAFE_DOWNCAST = 3,
  INCOMPATIBLE = 4,
}

export abstract class Type {
  constructor(
    public readonly name: string,
    public readonly signature: string
  ) {}

  /**
   * Check if this type accepts another type
   * Returns the cast type required for the conversion
   */
  abstract accepts(type: Type): CastType;

  /**
   * Check if this type is equal to another type
   */
  equals(type: Type): boolean {
    return this === type;
  }

  /**
   * Get the least upper bound (common supertype) of this type and another type
   */
  abstract getLeastUpperBound(type: Type): Type;

  /**
   * Check if this is a primitive type
   */
  isPrimitive(): boolean {
    return false;
  }

  /**
   * Check if this is a numeric type
   */
  isNumeric(): boolean {
    return false;
  }

  /**
   * Check if this is a compound type (union)
   */
  isCompound(): boolean {
    return false;
  }

  /**
   * Check if this is an array type
   */
  isArray(): boolean {
    return false;
  }

  /**
   * Check if this is a function type
   */
  isFunction(): boolean {
    return false;
  }

  /**
   * Check if this is a class type
   */
  isClass(): boolean {
    return false;
  }

  toString(): string {
    return this.name;
  }
}

/**
 * Primitive types
 */
export class PrimitiveType extends Type {
  constructor(name: string, signature: string) {
    super(name, signature);
  }

  isPrimitive(): boolean {
    return true;
  }

  accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type === Types.ANY) return CastType.UNSAFE_DOWNCAST;
    if (this === Types.ANY) return CastType.UPCAST;

    if (type.isCompound()) {
      return this.acceptsCompound(type as CompoundType);
    }

    return CastType.INCOMPATIBLE;
  }

  protected acceptsCompound(type: CompoundType): CastType {
    let best = CastType.INCOMPATIBLE;
    let worst = CastType.EQUALS;

    for (const t of type.types) {
      const r = this.accepts(t);
      if (r > worst) worst = r;
      if (r < best) best = r;
    }

    return worst;
  }

  getLeastUpperBound(type: Type): Type {
    if (this === type) return this;
    if (this === Types.ANY || type === Types.ANY) return Types.ANY;

    // Numeric promotions
    if (this.isNumeric() && type.isNumeric()) {
      if (this === Types.REAL || type === Types.REAL) return Types.REAL;
      if (this === Types.INT || type === Types.INT) return Types.INT;
    }

    // Create compound type
    return Types.compound(this, type);
  }

  isNumeric(): boolean {
    return this === Types.INT || this === Types.REAL;
  }
}

/**
 * Compound type (union of multiple types)
 */
export class CompoundType extends Type {
  constructor(public readonly types: Type[]) {
    super(
      types.map((t) => t.name).join(" | "),
      types.map((t) => t.signature).join("")
    );
  }

  isCompound(): boolean {
    return true;
  }

  accepts(type: Type): CastType {
    if (this.equals(type)) return CastType.EQUALS;

    // Check if any of our types accepts the given type
    let best = CastType.INCOMPATIBLE;
    for (const t of this.types) {
      const r = t.accepts(type);
      if (r < best) best = r;
    }

    return best;
  }

  equals(type: Type): boolean {
    if (!(type instanceof CompoundType)) return false;
    if (this.types.length !== type.types.length) return false;

    // Check if all types match (order independent)
    for (const t of this.types) {
      if (!type.types.some((ot) => ot === t)) return false;
    }
    return true;
  }

  getLeastUpperBound(type: Type): Type {
    if (this.equals(type)) return this;

    // Merge with another compound type
    if (type.isCompound()) {
      const allTypes = new Set<Type>([
        ...this.types,
        ...(type as CompoundType).types,
      ]);
      return new CompoundType([...allTypes]);
    }

    // Add new type to compound
    if (!this.types.includes(type)) {
      return new CompoundType([...this.types, type]);
    }

    return this;
  }

  hasType(type: Type): boolean {
    return this.types.includes(type);
  }
}

/**
 * Array type
 */
export class ArrayType extends Type {
  constructor(public readonly elementType: Type) {
    super(`array<${elementType.name}>`, `a${elementType.signature}`);
  }

  isArray(): boolean {
    return true;
  }

  accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type === Types.ANY) return CastType.UNSAFE_DOWNCAST;
    if (this.elementType === Types.ANY) return CastType.UPCAST;

    if (type instanceof ArrayType) {
      const elementCast = this.elementType.accepts(type.elementType);
      if (elementCast === CastType.EQUALS) return CastType.EQUALS;
      if (elementCast === CastType.UPCAST) return CastType.UPCAST;
      return CastType.UNSAFE_DOWNCAST;
    }

    if (type.isCompound()) {
      return this.acceptsCompound(type as CompoundType);
    }

    return CastType.INCOMPATIBLE;
  }

  protected acceptsCompound(type: CompoundType): CastType {
    let best = CastType.INCOMPATIBLE;
    let worst = CastType.EQUALS;

    for (const t of type.types) {
      const r = this.accepts(t);
      if (r > worst) worst = r;
      if (r < best) best = r;
    }

    return worst;
  }

  getLeastUpperBound(type: Type): Type {
    if (this.equals(type)) return this;

    if (type instanceof ArrayType) {
      const elementLUB = this.elementType.getLeastUpperBound(type.elementType);
      return Types.array(elementLUB);
    }

    return Types.compound(this, type);
  }

  equals(type: Type): boolean {
    if (!(type instanceof ArrayType)) return false;
    return this.elementType === type.elementType;
  }
}

/**
 * Map type (dictionary)
 */
export class MapType extends Type {
  constructor(public readonly keyType: Type, public readonly valueType: Type) {
    super(
      `map<${keyType.name}, ${valueType.name}>`,
      `m${keyType.signature}${valueType.signature}`
    );
  }

  accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type === Types.ANY) return CastType.UNSAFE_DOWNCAST;

    if (type instanceof MapType) {
      const keyCast = this.keyType.accepts(type.keyType);
      const valueCast = this.valueType.accepts(type.valueType);

      if (keyCast === CastType.EQUALS && valueCast === CastType.EQUALS) {
        return CastType.EQUALS;
      }
      if (keyCast <= CastType.UPCAST && valueCast <= CastType.UPCAST) {
        return CastType.UPCAST;
      }
      return CastType.UNSAFE_DOWNCAST;
    }

    return CastType.INCOMPATIBLE;
  }

  getLeastUpperBound(type: Type): Type {
    if (this.equals(type)) return this;

    if (type instanceof MapType) {
      const keyLUB = this.keyType.getLeastUpperBound(type.keyType);
      const valueLUB = this.valueType.getLeastUpperBound(type.valueType);
      return Types.map(keyLUB, valueLUB);
    }

    return Types.compound(this, type);
  }

  equals(type: Type): boolean {
    if (!(type instanceof MapType)) return false;
    return this.keyType === type.keyType && this.valueType === type.valueType;
  }
}

/**
 * Function type
 */
export class FunctionType extends Type {
  constructor(
    public readonly returnType: Type,
    public readonly parameterTypes: Type[] = []
  ) {
    super(
      `function(${parameterTypes.map((t) => t.name).join(", ")}) -> ${
        returnType.name
      }`,
      `f${parameterTypes.map((t) => t.signature).join("")}${
        returnType.signature
      }`
    );
  }

  isFunction(): boolean {
    return true;
  }

  accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type === Types.ANY) return CastType.UNSAFE_DOWNCAST;

    if (type instanceof FunctionType) {
      // Contravariant parameters, covariant return type
      if (this.parameterTypes.length !== type.parameterTypes.length) {
        return CastType.INCOMPATIBLE;
      }

      const returnCast = this.returnType.accepts(type.returnType);
      if (returnCast === CastType.INCOMPATIBLE) return CastType.INCOMPATIBLE;

      for (let i = 0; i < this.parameterTypes.length; i++) {
        const paramCast = type.parameterTypes[i].accepts(
          this.parameterTypes[i]
        );
        if (paramCast === CastType.INCOMPATIBLE) return CastType.INCOMPATIBLE;
      }

      return CastType.UPCAST;
    }

    return CastType.INCOMPATIBLE;
  }

  getLeastUpperBound(type: Type): Type {
    if (this.equals(type)) return this;
    return Types.compound(this, type);
  }

  equals(type: Type): boolean {
    if (!(type instanceof FunctionType)) return false;
    if (this.returnType !== type.returnType) return false;
    if (this.parameterTypes.length !== type.parameterTypes.length) return false;

    for (let i = 0; i < this.parameterTypes.length; i++) {
      if (this.parameterTypes[i] !== type.parameterTypes[i]) return false;
    }

    return true;
  }
}

/**
 * Class type
 */
export class ClassType extends Type {
  constructor(
    name: string,
    public readonly methods: Map<string, FunctionType> = new Map(),
    public readonly fields: Map<string, Type> = new Map()
  ) {
    super(name, `c${name}`);
  }

  isClass(): boolean {
    return true;
  }

  accepts(type: Type): CastType {
    if (type === this) return CastType.EQUALS;
    if (type === Types.ANY) return CastType.UNSAFE_DOWNCAST;
    // TODO: Handle class inheritance
    return CastType.INCOMPATIBLE;
  }

  getLeastUpperBound(type: Type): Type {
    if (this.equals(type)) return this;
    // TODO: Handle class inheritance
    return Types.compound(this, type);
  }

  hasMethod(name: string): boolean {
    return this.methods.has(name);
  }

  getMethod(name: string): FunctionType | undefined {
    return this.methods.get(name);
  }

  hasField(name: string): boolean {
    return this.fields.has(name);
  }

  getField(name: string): Type | undefined {
    return this.fields.get(name);
  }
}

/**
 * Error type (for type checking errors)
 */
export class ErrorType extends Type {
  constructor() {
    super("error", "e");
  }

  accepts(type: Type): CastType {
    return CastType.INCOMPATIBLE;
  }

  getLeastUpperBound(type: Type): Type {
    return this;
  }
}

/**
 * Type constants and factory methods
 */
export class Types {
  // Type caches for better performance (must be first!)
  private static arrayTypeCache = new Map<Type, ArrayType>();
  private static mapTypeCache = new Map<string, MapType>();
  private static compoundTypeCache = new Map<string, CompoundType>();
  private static functionTypeCache = new Map<string, FunctionType>();

  // Primitive types
  static readonly ERROR = new ErrorType();
  static readonly VOID = new PrimitiveType("void", "v");
  static readonly ANY = new PrimitiveType("any", "x");
  static readonly NULL = new PrimitiveType("null", "u");
  static readonly BOOL = new PrimitiveType("boolean", "b");
  static readonly INT = new PrimitiveType("integer", "i");
  static readonly REAL = new PrimitiveType("real", "r");
  static readonly STRING = new PrimitiveType("string", "s");

  // Collection types
  static readonly ARRAY = new ArrayType(Types.ANY);
  static readonly EMPTY_ARRAY = new ArrayType(Types.VOID);
  static readonly ARRAY_INT = new ArrayType(Types.INT);
  static readonly ARRAY_REAL = new ArrayType(Types.REAL);
  static readonly ARRAY_STRING = new ArrayType(Types.STRING);

  static readonly MAP = new MapType(Types.ANY, Types.ANY);
  static readonly EMPTY_MAP = new MapType(Types.VOID, Types.VOID);

  // Compound types
  static readonly INT_OR_NULL = Types.compound(Types.INT, Types.NULL);
  static readonly BOOL_OR_NULL = Types.compound(Types.BOOL, Types.NULL);
  static readonly INT_OR_BOOL = Types.compound(Types.INT, Types.BOOL);
  static readonly ARRAY_OR_NULL = Types.compound(Types.ARRAY, Types.NULL);
  static readonly STRING_OR_NULL = Types.compound(Types.STRING, Types.NULL);
  static readonly INT_OR_REAL = Types.compound(Types.INT, Types.REAL);

  // Function type
  static readonly FUNCTION = new FunctionType(Types.ANY);

  /**
   * Create or get cached array type
   */
  static array(elementType: Type): ArrayType {
    if (!this.arrayTypeCache.has(elementType)) {
      this.arrayTypeCache.set(elementType, new ArrayType(elementType));
    }
    return this.arrayTypeCache.get(elementType)!;
  }

  /**
   * Create or get cached map type
   */
  static map(keyType: Type, valueType: Type): MapType {
    const key = `${keyType.signature}:${valueType.signature}`;
    if (!this.mapTypeCache.has(key)) {
      this.mapTypeCache.set(key, new MapType(keyType, valueType));
    }
    return this.mapTypeCache.get(key)!;
  }

  /**
   * Create or get cached compound type
   */
  static compound(...types: Type[]): CompoundType {
    // Flatten nested compound types
    const flatTypes: Type[] = [];
    for (const type of types) {
      if (type instanceof CompoundType) {
        flatTypes.push(...type.types);
      } else {
        flatTypes.push(type);
      }
    }

    // Remove duplicates and sort for consistent keys
    const uniqueTypes = [...new Set(flatTypes)].sort((a, b) =>
      a.signature.localeCompare(b.signature)
    );

    const key = uniqueTypes.map((t) => t.signature).join("|");
    if (!this.compoundTypeCache.has(key)) {
      this.compoundTypeCache.set(key, new CompoundType(uniqueTypes));
    }
    return this.compoundTypeCache.get(key)!;
  }

  /**
   * Create or get cached function type
   */
  static function(returnType: Type, ...parameterTypes: Type[]): FunctionType {
    const key = `${parameterTypes.map((t) => t.signature).join(",")}:${
      returnType.signature
    }`;
    if (!this.functionTypeCache.has(key)) {
      this.functionTypeCache.set(
        key,
        new FunctionType(returnType, parameterTypes)
      );
    }
    return this.functionTypeCache.get(key)!;
  }

  /**
   * Get the least upper bound (common supertype) of multiple types
   */
  static getLeastUpperBound(...types: Type[]): Type {
    if (types.length === 0) return Types.VOID;
    if (types.length === 1) return types[0];

    let result = types[0];
    for (let i = 1; i < types.length; i++) {
      result = result.getLeastUpperBound(types[i]);
    }
    return result;
  }

  /**
   * Check if a type is assignable to another type
   */
  static isAssignable(target: Type, source: Type): boolean {
    const cast = target.accepts(source);
    return cast !== CastType.INCOMPATIBLE;
  }

  /**
   * Check if a cast is safe (no runtime errors)
   */
  static isSafeCast(target: Type, source: Type): boolean {
    const cast = target.accepts(source);
    return cast <= CastType.SAFE_DOWNCAST;
  }
}
