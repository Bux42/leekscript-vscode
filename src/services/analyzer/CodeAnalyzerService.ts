import * as vscode from "vscode";
import { HttpClient } from "../../utils/HttpClient";
import { ErrorHandler } from "../../utils/ErrorHandler";
import {
  AIFile,
  Folder,
  SaveAIResponse,
  NewAIResponse,
  OwnerIdResponse,
  ListAIsResponse,
  NewFolderResponse,
  ListFoldersResponse,
} from "./types";

/**
 * Configuration for the LeekScript Code Analysis Server
 */
const SERVER_HOST = "localhost";
const SERVER_PORT = 8080;

/**
 * Service for interacting with the LeekScript Code Analysis Server
 */
export class CodeAnalyzerService {
  private isServerRunning: boolean = false;
  private httpClient: HttpClient;

  constructor(private context: vscode.ExtensionContext) {
    this.httpClient = new HttpClient(SERVER_HOST, SERVER_PORT);
  }

  /**
   * Make an HTTP request to the Code Analysis Server
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    return this.httpClient.request<T>(method, path, body);
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

  // ==================== System Operations ====================

  /**
   * Reset the entire system to its initial state
   * WARNING: This operation is destructive and cannot be undone.
   * Clears all AI files, folders, persisted data, and resets the owner ID to 0.
   */
  async resetSystem(): Promise<boolean> {
    try {
      const response = await this.request<{ message: string }>(
        "POST",
        "/api/reset",
        {}
      );
      ErrorHandler.logInfo(`System reset: ${response.message}`);
      return true;
    } catch (error) {
      this.handleError("Failed to reset system", error);
      return false;
    }
  }

  // ==================== Owner Management ====================

  /**
   * Set the owner (farmer) ID for the codebase
   */
  async setOwnerId(ownerId: number): Promise<void> {
    try {
      await this.request("POST", "/api/owner/set-id", { owner_id: ownerId });
      ErrorHandler.logInfo(`Owner ID set to ${ownerId}`);
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
      const response = await this.request<OwnerIdResponse>(
        "GET",
        "/api/owner/get-id"
      );
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
  async createAI(
    folderId: number,
    name: string,
    version: number = 4
  ): Promise<AIFile | null> {
    try {
      const response = await this.request<NewAIResponse>(
        "POST",
        "/api/ai/new-name",
        {
          folder_id: folderId,
          version,
          name,
        }
      );
      ErrorHandler.logInfo(`Created AI: ${name} (ID: ${response.ai.id})`);
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
      const response = await this.request<SaveAIResponse>(
        "POST",
        "/api/ai/save",
        {
          ai_id: aiId,
          code,
        }
      );

      const errors = response.result[aiId.toString()];
      const errorCount = errors.filter((e) => e[0] === 0).length;
      const warningCount = errors.filter((e) => e[0] === 1).length;

      ErrorHandler.logInfo(
        `Saved AI ${aiId}: ${errorCount} errors, ${warningCount} warnings`
      );
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
      ErrorHandler.logInfo(`Renamed AI ${aiId} to ${newName}`);
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
      ErrorHandler.logInfo(`Deleted AI ${aiId}`);
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
      ErrorHandler.logInfo(`Moved AI ${aiId} to folder ${folderId}`);
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
      const response = await this.request<AIFile>(
        "GET",
        `/api/ai/get?ai_id=${aiId}`
      );
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
      const path =
        folderId !== undefined
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
  async createFolder(
    parentFolderId: number,
    name: string
  ): Promise<number | null> {
    try {
      const response = await this.request<NewFolderResponse>(
        "POST",
        "/api/ai-folder/new-name",
        {
          parent_folder_id: parentFolderId,
          name,
        }
      );
      ErrorHandler.logInfo(`Created folder: ${name} (ID: ${response.id})`);
      return response.id;
    } catch (error) {
      this.handleError(`Failed to create folder: ${name}`, error);
      return null;
    }
  }

  /**
   * Create a new folder with a user-specified ID
   */
  async createFolderWithId(
    folderId: number,
    parentFolderId: number,
    name: string
  ): Promise<number | null> {
    try {
      const response = await this.request<NewFolderResponse>(
        "POST",
        "/api/ai-folder/new-name-with-id",
        {
          folder_id: folderId,
          parent_folder_id: parentFolderId,
          name,
        }
      );
      ErrorHandler.logInfo(
        `Created folder with ID: ${name} (ID: ${response.id})`
      );
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
      ErrorHandler.logInfo(`Renamed folder ${folderId} to ${newName}`);
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
      await this.request("DELETE", "/api/ai-folder/delete", {
        folder_id: folderId,
      });
      ErrorHandler.logInfo(`Deleted folder ${folderId} and its contents`);
      return true;
    } catch (error) {
      this.handleError(`Failed to delete folder ${folderId}`, error);
      return false;
    }
  }

  /**
   * Move a folder to a different parent folder
   */
  async changeFolderParent(
    folderId: number,
    destFolderId: number
  ): Promise<boolean> {
    try {
      await this.request("POST", "/api/ai-folder/change-folder", {
        folder_id: folderId,
        dest_folder_id: destFolderId,
      });
      ErrorHandler.logInfo(
        `Moved folder ${folderId} to folder ${destFolderId}`
      );
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
      const response = await this.request<Folder>(
        "GET",
        `/api/ai-folder/get?folder_id=${folderId}`
      );
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
      const response = await this.request<ListFoldersResponse>(
        "GET",
        "/api/ai-folder/list"
      );
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
    ErrorHandler.handleCodeAnalyzerError(message, error);
  }
}
