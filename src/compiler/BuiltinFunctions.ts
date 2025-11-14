/**
 * Built-in LeekWars functions loader
 * Loads function definitions from leek-wars functions.ts
 */

import { Type } from "./type-system/Type";
import { SymbolTable } from "./SymbolTable";
import { FunctionInfo } from "./types";

// Type ID mapping from leek-wars format to our Type system
const TYPE_MAP: Record<number, Type> = {
  "-1": Type.ANY, // any type
  "0": Type.VOID, // void
  "1": Type.ANY, // number (int or real in old format)
  "2": Type.STRING, // string
  "3": Type.BOOL, // boolean
  "4": Type.ARRAY, // array
  "5": Type.FUNCTION, // function
  "6": Type.INT, // integer
  "7": Type.REAL, // real/float
  "9": Type.SET, // set
  // Add more as needed
};

function mapType(typeId: string | number): Type {
  const id = typeof typeId === "string" ? parseInt(typeId, 10) : typeId;
  return TYPE_MAP[id] || Type.ANY;
}

/**
 * Registers all built-in LeekWars functions into the global symbol table
 */
export function registerBuiltinFunctions(symbolTable: SymbolTable): void {
  // Temporary: Register common LeekWars functions manually
  // TODO: Load from leek-wars/src/model/functions.ts once path aliases are resolved

  const builtins: Array<{ name: string; returnType: Type; params: string[] }> =
    [
      { name: "getName", returnType: Type.STRING, params: ["entity"] },
      { name: "getNearestEnemy", returnType: Type.INT, params: [] },
      { name: "getNearestAlly", returnType: Type.INT, params: [] },
      { name: "getLife", returnType: Type.INT, params: ["entity"] },
      { name: "getTP", returnType: Type.INT, params: ["entity"] },
      { name: "getMP", returnType: Type.INT, params: ["entity"] },
      { name: "getCell", returnType: Type.INT, params: ["entity"] },
      { name: "debug", returnType: Type.VOID, params: ["value"] },
      { name: "say", returnType: Type.VOID, params: ["message"] },
      { name: "useWeapon", returnType: Type.INT, params: ["entity"] },
      { name: "useChip", returnType: Type.INT, params: ["chip", "entity"] },
      { name: "moveToward", returnType: Type.INT, params: ["entity"] },
      { name: "getWeapon", returnType: Type.INT, params: [] },
      { name: "getChips", returnType: Type.ARRAY, params: [] },
      { name: "abs", returnType: Type.INT, params: ["number"] },
      { name: "floor", returnType: Type.INT, params: ["number"] },
      { name: "ceil", returnType: Type.INT, params: ["number"] },
      { name: "round", returnType: Type.INT, params: ["number"] },
      { name: "sqrt", returnType: Type.REAL, params: ["number"] },
      { name: "cos", returnType: Type.REAL, params: ["angle"] },
      { name: "sin", returnType: Type.REAL, params: ["angle"] },
      { name: "tan", returnType: Type.REAL, params: ["angle"] },
      { name: "length", returnType: Type.INT, params: ["value"] },
      { name: "count", returnType: Type.INT, params: ["array"] },
      { name: "push", returnType: Type.VOID, params: ["array", "value"] },
      { name: "pop", returnType: Type.ANY, params: ["array"] },
    ];

  for (const func of builtins) {
    const functionInfo: FunctionInfo = {
      name: func.name,
      paramCount: func.params.length,
      returnType: func.returnType,
      parameters: func.params,
      line: 0, // Built-in functions don't have line numbers
    };

    symbolTable.registerFunction(func.name, functionInfo);
  }
}
