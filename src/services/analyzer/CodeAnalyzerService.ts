import * as vscode from "vscode";
import * as http from "http";

/**
 * Configuration for the LeekScript Code Analysis Server
 */
const SERVER_HOST = "localhost";
const SERVER_PORT = 8080;

/**
 * AI File Object structure
 */
export interface AIFile {
  id: number;
  name: string;
  folder_id: number;
  code?: string;
  version: number;
  level?: number;
}

/**
 * Folder Object structure
 */
export interface Folder {
  id: number;
  name: string;
  parent_id: number;
}

/**
 * Analysis Error Format
 * [level, ai_id, start_line, start_column, end_line, end_column, error_code, parameters]
 */
export type AnalysisError = [
  number, // level: 0 = error, 1 = warning
  number, // ai_id
  number, // start_line
  number, // start_column
  number, // end_line
  number, // end_column
  number, // error_code
  string[] // parameters
];

/**
 * Save AI Response structure
 */
export interface SaveAIResponse {
  result: {
    [ai_id: string]: AnalysisError[];
  };
  modified: number;
}

/**
 * Owner ID Response structure
 */
export interface OwnerIdResponse {
  owner_id: number;
}

/**
 * New AI Response structure
 */
export interface NewAIResponse {
  ai: AIFile;
}

/**
 * New Folder Response structure
 */
export interface NewFolderResponse {
  id: number;
}

/**
 * List AIs Response structure
 */
export interface ListAIsResponse {
  ais: AIFile[];
}

/**
 * List Folders Response structure
 */
export interface ListFoldersResponse {
  folders: Folder[];
}

/**
 * Service for interacting with the LeekScript Code Analysis Server
 */
export class CodeAnalyzerService {
  private isServerRunning: boolean = false;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Make an HTTP request to the Code Analysis Server
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
      };

      const req = http.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Handle empty responses or plain text
              if (!data || data.trim().length === 0) {
                resolve([] as any);
              } else if (data.startsWith("{") || data.startsWith("[")) {
                resolve(JSON.parse(data));
              } else {
                // Plain text response
                resolve(data as any);
              }
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          } else {
            // Error response
            reject({
              statusCode: res.statusCode,
              message: data,
            });
          }
        });
      });

      req.on("error", (error) => {
        reject({
          code: (error as any).code || "UNKNOWN",
          message: error.message,
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject({
          code: "ETIMEDOUT",
          message: "Request timeout",
        });
      });

      // Write body if present
      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Check if the analysis server is running
   */
  async checkServerStatus(): Promise<boolean> {
    try {
      await this.request<string>("GET", "/");
      this.isServerRunning = true;
      return true;
    } catch (error) {
      this.isServerRunning = false;
      return false;
    }
  }

  /**
   * Get the server running status
   */
  getServerStatus(): boolean {
    return this.isServerRunning;
  }

  /**
   * Show a notification if the server is not running
   */
  async notifyIfServerNotRunning(): Promise<boolean> {
    const isRunning = await this.checkServerStatus();
    
    if (!isRunning) {
      vscode.window.showWarningMessage(
        "LeekScript Code Analysis Server is not running. Please start the server to use code analysis features."
      );
    }
    
    return isRunning;
  }

  // ==================== Owner Management ====================

  /**
   * Set the owner (farmer) ID for the codebase
   */
  async setOwnerId(ownerId: number): Promise<void> {
    try {
      await this.request("POST", "/api/owner/set-id", { owner_id: ownerId });
      console.log(`[CodeAnalyzer] Owner ID set to ${ownerId}`);
    } catch (error) {
      this.handleError("Failed to set owner ID", error);
      throw error;
    }
  }

  /**
   * Get the current owner ID
   */
  async getOwnerId(): Promise<number | null> {
    try {
      const response = await this.request<OwnerIdResponse>("GET", "/api/owner/get-id");
      return response.owner_id;
    } catch (error) {
      this.handleError("Failed to get owner ID", error);
      return null;
    }
  }

  // ==================== AI File Operations ====================

  /**
   * Create a new AI file with default code
   */
  async createAI(folderId: number, name: string, version: number = 4): Promise<AIFile | null> {
    try {
      const response = await this.request<NewAIResponse>("POST", "/api/ai/new-name", {
        folder_id: folderId,
        version,
        name,
      });
      console.log(`[CodeAnalyzer] Created AI: ${name} (ID: ${response.ai.id})`);
      return response.ai;
    } catch (error) {
      this.handleError(`Failed to create AI: ${name}`, error);
      return null;
    }
  }

  /**
   * Save code to an AI file and run analysis
   */
  async saveAI(aiId: number, code: string): Promise<SaveAIResponse | null> {
    try {
      const response = await this.request<SaveAIResponse>("POST", "/api/ai/save", {
        ai_id: aiId,
        code,
      });
      
      const errors = response.result[aiId.toString()];
      const errorCount = errors.filter(e => e[0] === 0).length;
      const warningCount = errors.filter(e => e[0] === 1).length;
      
      console.log(`[CodeAnalyzer] Saved AI ${aiId}: ${errorCount} errors, ${warningCount} warnings`);
      return response;
    } catch (error) {
      this.handleError(`Failed to save AI ${aiId}`, error);
      return null;
    }
  }

  /**
   * Rename an AI file
   */
  async renameAI(aiId: number, newName: string): Promise<boolean> {
    try {
      await this.request("POST", "/api/ai/rename", {
        ai_id: aiId,
        new_name: newName,
      });
      console.log(`[CodeAnalyzer] Renamed AI ${aiId} to ${newName}`);
      return true;
    } catch (error) {
      this.handleError(`Failed to rename AI ${aiId}`, error);
      return false;
    }
  }

  /**
   * Delete an AI file
   */
  async deleteAI(aiId: number): Promise<boolean> {
    try {
      await this.request("DELETE", "/api/ai/delete", { ai_id: aiId });
      console.log(`[CodeAnalyzer] Deleted AI ${aiId}`);
      return true;
    } catch (error) {
      this.handleError(`Failed to delete AI ${aiId}`, error);
      return false;
    }
  }

  /**
   * Move an AI file to a different folder
   */
  async changeAIFolder(aiId: number, folderId: number): Promise<boolean> {
    try {
      await this.request("POST", "/api/ai/change-folder", {
        ai_id: aiId,
        folder_id: folderId,
      });
      console.log(`[CodeAnalyzer] Moved AI ${aiId} to folder ${folderId}`);
      return true;
    } catch (error) {
      this.handleError(`Failed to move AI ${aiId}`, error);
      return false;
    }
  }

  /**
   * Get information about a specific AI file
   */
  async getAI(aiId: number): Promise<AIFile | null> {
    try {
      const response = await this.request<AIFile>("GET", `/api/ai/get?ai_id=${aiId}`);
      return response;
    } catch (error) {
      this.handleError(`Failed to get AI ${aiId}`, error);
      return null;
    }
  }

  /**
   * List all AI files, optionally filtered by folder
   */
  async listAIs(folderId?: number): Promise<AIFile[]> {
    try {
      const path = folderId !== undefined 
        ? `/api/ai/list?folder_id=${folderId}` 
        : "/api/ai/list";
      const response = await this.request<ListAIsResponse>("GET", path);
      return response.ais;
    } catch (error) {
      this.handleError("Failed to list AIs", error);
      return [];
    }
  }

  // ==================== Folder Operations ====================

  /**
   * Create a new folder with an auto-generated ID
   */
  async createFolder(parentFolderId: number, name: string): Promise<number | null> {
    try {
      const response = await this.request<NewFolderResponse>("POST", "/api/ai-folder/new-name", {
        parent_folder_id: parentFolderId,
        name,
      });
      console.log(`[CodeAnalyzer] Created folder: ${name} (ID: ${response.id})`);
      return response.id;
    } catch (error) {
      this.handleError(`Failed to create folder: ${name}`, error);
      return null;
    }
  }

  /**
   * Create a new folder with a user-specified ID
   */
  async createFolderWithId(folderId: number, parentFolderId: number, name: string): Promise<number | null> {
    try {
      const response = await this.request<NewFolderResponse>("POST", "/api/ai-folder/new-name-with-id", {
        folder_id: folderId,
        parent_folder_id: parentFolderId,
        name,
      });
      console.log(`[CodeAnalyzer] Created folder with ID: ${name} (ID: ${response.id})`);
      return response.id;
    } catch (error) {
      this.handleError(`Failed to create folder with ID: ${name}`, error);
      return null;
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderId: number, newName: string): Promise<boolean> {
    try {
      await this.request("POST", "/api/ai-folder/rename", {
        folder_id: folderId,
        new_name: newName,
      });
      console.log(`[CodeAnalyzer] Renamed folder ${folderId} to ${newName}`);
      return true;
    } catch (error) {
      this.handleError(`Failed to rename folder ${folderId}`, error);
      return false;
    }
  }

  /**
   * Delete a folder and all its contents (cascade delete)
   */
  async deleteFolder(folderId: number): Promise<boolean> {
    try {
      await this.request("DELETE", "/api/ai-folder/delete", { folder_id: folderId });
      console.log(`[CodeAnalyzer] Deleted folder ${folderId} and its contents`);
      return true;
    } catch (error) {
      this.handleError(`Failed to delete folder ${folderId}`, error);
      return false;
    }
  }

  /**
   * Move a folder to a different parent folder
   */
  async changeFolderParent(folderId: number, destFolderId: number): Promise<boolean> {
    try {
      await this.request("POST", "/api/ai-folder/change-folder", {
        folder_id: folderId,
        dest_folder_id: destFolderId,
      });
      console.log(`[CodeAnalyzer] Moved folder ${folderId} to folder ${destFolderId}`);
      return true;
    } catch (error) {
      this.handleError(`Failed to move folder ${folderId}`, error);
      return false;
    }
  }

  /**
   * Get information about a specific folder
   */
  async getFolder(folderId: number): Promise<Folder | null> {
    try {
      const response = await this.request<Folder>("GET", `/api/ai-folder/get?folder_id=${folderId}`);
      return response;
    } catch (error) {
      this.handleError(`Failed to get folder ${folderId}`, error);
      return null;
    }
  }

  /**
   * List all folders
   */
  async listFolders(): Promise<Folder[]> {
    try {
      const response = await this.request<ListFoldersResponse>("GET", "/api/ai-folder/list");
      return response.folders;
    } catch (error) {
      this.handleError("Failed to list folders", error);
      return [];
    }
  }

  // ==================== Error Handling ====================

  /**
   * Handle errors and display user-friendly messages
   */
  private handleError(message: string, error: any): void {
    console.error(`[CodeAnalyzer] ${message}:`, error);

    // Check if it's our custom error object from the request method
    if (error && typeof error === "object") {
      if (error.code === "ECONNREFUSED") {
        vscode.window.showErrorMessage(
          `${message}: Code Analysis Server is not running. Please start the server.`
        );
      } else if (error.code === "ETIMEDOUT") {
        vscode.window.showErrorMessage(
          `${message}: Request timeout. Server may be unresponsive.`
        );
      } else if (error.statusCode) {
        const statusCode = error.statusCode;
        const errorData = error.message;
        
        if (statusCode === 404) {
          vscode.window.showErrorMessage(
            `${message}: Resource not found - ${errorData}`
          );
        } else if (statusCode === 405) {
          vscode.window.showErrorMessage(
            `${message}: Invalid HTTP method`
          );
        } else {
          vscode.window.showErrorMessage(
            `${message}: ${errorData || "Unknown error"}`
          );
        }
      } else if (error.message) {
        vscode.window.showErrorMessage(
          `${message}: ${error.message}`
        );
      } else {
        vscode.window.showErrorMessage(
          `${message}: Unknown error`
        );
      }
    } else {
      vscode.window.showErrorMessage(
        `${message}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
