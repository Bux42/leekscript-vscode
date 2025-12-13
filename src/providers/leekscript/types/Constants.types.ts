/**
 * Function data structure from functions.json
 */
export interface FunctionData {
  name: string;
  arguments_names: string[];
  arguments_types: number[];
  optional?: boolean[];
  return_type: number;
  return_name?: string;
  operations?: number;
}

/**
 * Constant category identifiers
 */
export class ConstantCategory {
  public static readonly CHIP = 7;
}

/**
 * Constant data structure from constants.json
 */
export interface ConstantData {
  name: string;
  value: number | string;
  category: number;
}

/**
 * Type mappings for LeekScript built-in types
 */
export const TYPE_MAP: { [key: string]: string } = {
  "-1": "any",
  "1": "number",
  "2": "string",
  "3": "boolean",
  "4": "array",
  "41": "array<number>",
  "42": "array<string>",
  "43": "array<boolean>",
  "44": "array<array>",
  "46": "array<integer>",
  "47": "array<real>",
  "5": "function",
  "6": "integer",
  "7": "real",
  "8": "map",
};
