/**
 * Type definitions for the Code Analyzer Service
 * These types represent the data structures used when communicating with the Code Analysis Server.
 */

/**
 * Represents an AI file in the codebase
 */
export interface AIFile {
  /** Unique identifier for the AI */
  id: number;
  /** ID of the folder containing this AI */
  folder: number;
  /** Name of the AI file */
  name: string;
  /** LeekScript code content */
  code: string;
  /** LeekScript version (e.g., 4 for LS4) */
  version: number;
}

/**
 * Represents a folder containing AI files
 */
export interface Folder {
  /** Unique identifier for the folder */
  id: number;
  /** Name of the folder */
  name: string;
  /** ID of the parent folder (0 for root) */
  folder: number;
}

/**
 * Represents an analysis error or warning
 * Format: [level, ai_id, start_line, start_column, end_line, end_column, error_code, parameters]
 */
export type AnalysisError = [
  number, // level: 0 = error, 1 = warning
  number, // ai_id: ID of the AI file
  number, // start_line: Starting line number (1-based)
  number, // start_column: Starting column number (1-based)
  number, // end_line: Ending line number (1-based)
  number, // end_column: Ending column number (1-based)
  number, // error_code: Numeric error code
  string[] // parameters: Array of parameters for error message formatting
];

/**
 * Response from saving an AI file
 */
export interface SaveAIResponse {
  /** Analysis results keyed by AI ID */
  result: {
    [aiId: string]: AnalysisError[];
  };
}

/**
 * Response from creating a new AI file
 */
export interface NewAIResponse {
  /** The newly created AI file */
  ai: AIFile;
}

/**
 * Response from getting the owner ID
 */
export interface OwnerIdResponse {
  /** The current owner (farmer) ID, or null if not set */
  owner_id: number | null;
}

/**
 * Response from listing AI files
 */
export interface ListAIsResponse {
  /** Array of AI files */
  ais: AIFile[];
}

/**
 * Response from creating a new folder
 */
export interface NewFolderResponse {
  /** The ID of the newly created folder */
  id: number;
}

/**
 * Response from listing folders
 */
export interface ListFoldersResponse {
  /** Array of folders */
  folders: Folder[];
}

/**
 * HTTP error object structure
 */
export interface HttpError {
  /** Error code (e.g., ECONNREFUSED, ETIMEDOUT) */
  code?: string;
  /** HTTP status code (e.g., 404, 500) */
  statusCode?: number;
  /** Error message */
  message: string;
}
