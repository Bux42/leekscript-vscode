/**
 * Core types for the LeekScript compiler
 * Ported from Java leekscript-local implementation
 */

// Note: Token type is defined in leekscript-ts but not exported yet
// For now, we'll use 'any' and type it properly during integration
export type Token = any;

/**
 * Error severity level
 */
export enum AnalyzeErrorLevel {
  ERROR = 0,
  WARNING = 1,
}

/**
 * Location in source code
 */
export interface Location {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Analysis error with location and details
 */
export interface AnalyzeError {
  level: AnalyzeErrorLevel;
  file: number; // AI file ID
  location: Location;
  errorType: number; // Error enum ordinal
  parameters: string[]; // Error message parameters
}

/**
 * Result of compilation analysis
 */
export interface AnalyzeResult {
  informations: AnalyzeError[]; // Array of errors/warnings (internal format)
  informationsJSON: any[][]; // JSON array format matching Java generator
  includedAIs: Set<AIFile>; // Set of included files
  success: boolean; // true if no errors
  tooMuchErrors?: Error; // Timeout or error limit exceeded
  parseTime?: number; // Time spent parsing (ms)
  analyzeTime?: number; // Time spent analyzing (ms)
}

/**
 * Compilation options
 */
export interface Options {
  version: number; // LeekScript version
  strict: boolean; // Strict mode
  useCache: boolean;
  enableOperations: boolean;
  session?: any;
  useExtra: boolean; // Enable extra functions
}

/**
 * Token stream for parsing
 */
export interface TokenStream {
  tokens: Token[];
  position: number;

  hasMoreTokens(): boolean;
  get(): Token;
  eat(): Token;
  skip(): void;
  reset(): void;
  unskip(): void;
}

/**
 * AI file representation
 */
export interface AIFile {
  id: number;
  path: string; // File name (e.g., "my_ai.leek")
  code: string;
  version: number;
  owner: number;
  folder: Folder; // Parent folder for resolving includes
  timestamp: number;
  strict: boolean;
  tokens?: TokenStream;
  errors: AnalyzeError[];
  compilationOptions?: Options;

  clearErrors(): void;
  getFolder(): Folder;
  getCode(): string;
  setCode(code: string): void;
  setTokenStream(tokens: TokenStream): void;
}

/**
 * Folder in the file system hierarchy
 * Used for resolving include paths
 */
export interface Folder {
  id: number;
  owner: number;
  name: string;
  parent: Folder | null; // Parent folder (null for root)
  root: Folder; // Root folder
  files: Map<string, AIFile>; // Files in this folder
  folders: Map<string, Folder>; // Subfolders
  timestamp: number;

  /**
   * Resolve a relative or absolute path from this folder
   *
   * Examples:
   * - "/path" → resolve from root folder
   * - "./path" → resolve from current folder
   * - "../path" → resolve from parent folder
   * - "folder/file" → resolve subfolder then file
   *
   * @param path The path to resolve
   * @returns The resolved AIFile or null if not found
   */
  resolve(path: string): AIFile | null;

  /**
   * Get a subfolder by name
   */
  getFolder(name: string): Folder | null;

  /**
   * Get a file by name
   */
  getFile(name: string): AIFile | null;

  /**
   * Add a subfolder
   */
  addFolder(name: string, folder: Folder): void;

  /**
   * Add a file
   */
  addFile(name: string, file: AIFile): void;
}

/**
 * Variable information in symbol table
 */
export interface VariableInfo {
  name: string;
  type: any; // Type from type system
  line: number;
  isGlobal: boolean;
  isParameter: boolean;
  isConstant: boolean;
}

/**
 * Function information in symbol table
 */
export interface FunctionInfo {
  name: string;
  paramCount: number;
  returnType?: any; // Type from type system
  parameters: string[];
  line: number;
  block?: any; // FunctionBlock - the function's body block
}

/**
 * Class information in symbol table
 */
export interface ClassInfo {
  name: string;
  line: number;
  fields: Map<string, any>; // Field name -> type
  methods: Map<string, FunctionInfo>; // Method name -> function info
  staticMethods: Map<string, FunctionInfo>;
  parent?: string; // Parent class name
}
