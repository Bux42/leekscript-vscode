import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import {
  CodeBaseState,
  CodeBaseFile,
  CodeBaseFolder,
  LocalFileState,
  LocalFolderState,
  LeekWarsFileState,
  LeekWarsFolderState,
  CodeAnalyzerFileState,
  CodeAnalyzerFolderState,
  SerializedCodeBaseState,
  CodeBaseStateHelpers,
  SyncStatus,
} from "./CodeBaseState";
import { LeekWarsAIInfo } from "../leekwars/LeekWarsApi";

/**
 * Service for managing the complete codebase state
 */
export class CodeBaseStateManager {
  private state: CodeBaseState;
  private static readonly STORAGE_KEY = "codebase.state";

  constructor(private context: vscode.ExtensionContext) {
    this.state = this.loadState();
  }

  /**
   * Get the current codebase state
   */
  getState(): CodeBaseState {
    return this.state;
  }

  /**
   * Load state from persistent storage
   */
  private loadState(): CodeBaseState {
    try {
      const stored = this.context.globalState.get<SerializedCodeBaseState>(
        CodeBaseStateManager.STORAGE_KEY
      );
      if (stored) {
        console.log("[CodeBaseState] Loaded state from persistent storage");
        return CodeBaseStateHelpers.deserialize(stored);
      }
    } catch (error) {
      console.error("[CodeBaseState] Failed to load state:", error);
    }
    return CodeBaseStateHelpers.createEmpty();
  }

  /**
   * Save state to persistent storage
   */
  async saveState(): Promise<void> {
    try {
      const serialized = CodeBaseStateHelpers.serialize(this.state);
      await this.context.globalState.update(
        CodeBaseStateManager.STORAGE_KEY,
        serialized
      );
      console.log("[CodeBaseState] Saved state to persistent storage");
    } catch (error) {
      console.error("[CodeBaseState] Failed to save state:", error);
      throw error;
    }
  }

  /**
   * Clear all state
   */
  async clearState(): Promise<void> {
    this.state = CodeBaseStateHelpers.createEmpty();
    await this.saveState();
    console.log("[CodeBaseState] Cleared all state");
  }

  /**
   * Set owner ID
   */
  async setOwnerId(ownerId: number): Promise<void> {
    this.state.ownerId = ownerId;
    await this.saveState();
  }

  /**
   * Get owner ID
   */
  getOwnerId(): number | null {
    return this.state.ownerId;
  }

  // ==================== File Operations ====================

  /**
   * Get file by absolute path
   */
  getFile(absolutePath: string): CodeBaseFile | undefined {
    return this.state.files.get(absolutePath);
  }

  /**
   * Get all files
   */
  getAllFiles(): CodeBaseFile[] {
    return Array.from(this.state.files.values());
  }

  /**
   * Get file by LeekWars AI ID
   */
  getFileByLeekWarsId(aiId: number): CodeBaseFile | null {
    return CodeBaseStateHelpers.findFileByLeekWarsId(this.state, aiId);
  }

  /**
   * Get file by CodeAnalyzer AI ID
   */
  getFileByAnalyzerId(aiId: number): CodeBaseFile | null {
    return CodeBaseStateHelpers.findFileByAnalyzerId(this.state, aiId);
  }

  /**
   * Add or update a file's local state
   */
  async updateFileLocalState(
    absolutePath: string,
    workspaceRoot: string
  ): Promise<void> {
    const stats = fs.statSync(absolutePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const hash = crypto.createHash("md5").update(content).digest("hex");

    const localState: LocalFileState = {
      absolutePath,
      relativePath: path.relative(workspaceRoot, absolutePath),
      size: stats.size,
      lastModified: stats.mtimeMs,
      contentHash: hash,
    };

    const existingFile = this.state.files.get(absolutePath);
    if (existingFile) {
      existingFile.local = localState;
    } else {
      this.state.files.set(absolutePath, {
        local: localState,
        leekwars: null,
        analyzer: null,
      });
    }

    await this.saveState();
  }

  /**
   * Update a file's LeekWars state
   */
  async updateFileLeekWarsState(
    absolutePath: string,
    leekwarsState: LeekWarsFileState
  ): Promise<void> {
    const file = this.state.files.get(absolutePath);
    if (file) {
      file.leekwars = leekwarsState;
    } else {
      console.warn(
        `[CodeBaseState] Cannot update LeekWars state for unknown file: ${absolutePath}`
      );
      return;
    }
    await this.saveState();
  }

  /**
   * Update a file's CodeAnalyzer state
   */
  async updateFileAnalyzerState(
    absolutePath: string,
    analyzerState: CodeAnalyzerFileState
  ): Promise<void> {
    const file = this.state.files.get(absolutePath);
    if (file) {
      file.analyzer = analyzerState;
    } else {
      console.warn(
        `[CodeBaseState] Cannot update Analyzer state for unknown file: ${absolutePath}`
      );
      return;
    }
    await this.saveState();
  }

  /**
   * Remove a file from state
   */
  async removeFile(absolutePath: string): Promise<void> {
    this.state.files.delete(absolutePath);
    await this.saveState();
  }

  /**
   * Get sync status for a file
   */
  getFileSyncStatus(absolutePath: string): SyncStatus | null {
    const file = this.state.files.get(absolutePath);
    if (!file) {
      return null;
    }
    return CodeBaseStateHelpers.getFileSyncStatus(file);
  }

  // ==================== Folder Operations ====================

  /**
   * Get folder by ID
   */
  getFolder(folderId: string): CodeBaseFolder | undefined {
    return this.state.folders.get(folderId);
  }

  /**
   * Get all folders
   */
  getAllFolders(): CodeBaseFolder[] {
    return Array.from(this.state.folders.values());
  }

  /**
   * Get folder by LeekWars folder ID
   */
  getFolderByLeekWarsId(folderId: number): CodeBaseFolder | null {
    return CodeBaseStateHelpers.findFolderByLeekWarsId(this.state, folderId);
  }

  /**
   * Get folder by CodeAnalyzer folder ID
   */
  getFolderByAnalyzerId(folderId: number): CodeBaseFolder | null {
    return CodeBaseStateHelpers.findFolderByAnalyzerId(this.state, folderId);
  }

  /**
   * Add or update a folder's local state
   */
  async updateFolderLocalState(
    folderId: string,
    absolutePath: string,
    workspaceRoot: string,
    parentFolderId: string | null
  ): Promise<void> {
    const stats = fs.statSync(absolutePath);

    const localState: LocalFolderState = {
      absolutePath,
      relativePath: path.relative(workspaceRoot, absolutePath),
      lastModified: stats.mtimeMs,
    };

    const existingFolder = this.state.folders.get(folderId);
    if (existingFolder) {
      existingFolder.local = localState;
      existingFolder.parentFolderId = parentFolderId;
    } else {
      this.state.folders.set(folderId, {
        id: folderId,
        local: localState,
        leekwars: null,
        analyzer: null,
        parentFolderId,
      });
    }

    await this.saveState();
  }

  /**
   * Update a folder's LeekWars state
   */
  async updateFolderLeekWarsState(
    folderId: string,
    leekwarsState: LeekWarsFolderState
  ): Promise<void> {
    const folder = this.state.folders.get(folderId);
    if (folder) {
      folder.leekwars = leekwarsState;
    } else {
      console.warn(
        `[CodeBaseState] Cannot update LeekWars state for unknown folder: ${folderId}`
      );
      return;
    }
    await this.saveState();
  }

  /**
   * Update a folder's CodeAnalyzer state
   */
  async updateFolderAnalyzerState(
    folderId: string,
    analyzerState: CodeAnalyzerFolderState
  ): Promise<void> {
    const folder = this.state.folders.get(folderId);
    if (folder) {
      folder.analyzer = analyzerState;
    } else {
      console.warn(
        `[CodeBaseState] Cannot update Analyzer state for unknown folder: ${folderId}`
      );
      return;
    }
    await this.saveState();
  }

  /**
   * Remove a folder from state
   */
  async removeFolder(folderId: string): Promise<void> {
    this.state.folders.delete(folderId);
    await this.saveState();
  }

  /**
   * Get sync status for a folder
   */
  getFolderSyncStatus(folderId: string): SyncStatus | null {
    const folder = this.state.folders.get(folderId);
    if (!folder) {
      return null;
    }
    return CodeBaseStateHelpers.getFolderSyncStatus(folder);
  }

  /**
   * Get all files in a folder
   */
  getFilesInFolder(folderId: string): CodeBaseFile[] {
    return CodeBaseStateHelpers.getFilesInFolder(this.state, folderId);
  }

  /**
   * Get all subfolders of a folder
   */
  getSubfolders(folderId: string | null): CodeBaseFolder[] {
    return CodeBaseStateHelpers.getSubfolders(this.state, folderId);
  }

  // ==================== Bulk Operations ====================

  /**
   * Sync from LeekWars API response
   * This updates the state based on the LeekWars API data
   */
  async syncFromLeekWars(
    ais: LeekWarsAIInfo[],
    folders: Array<{ id: number; name: string; folder: number }>,
    workspaceRoot: string,
    leekwarsDir: string
  ): Promise<void> {
    // Update folders
    for (const folderInfo of folders) {
      const folderId = `leekwars-${folderInfo.id}`;
      const parentFolderId =
        folderInfo.folder === 0 ? null : `leekwars-${folderInfo.folder}`;

      const leekwarsState: LeekWarsFolderState = {
        id: folderInfo.id,
        name: folderInfo.name,
        parentFolderId: folderInfo.folder,
      };

      // Construct local path
      const folderPath = this.constructFolderPath(
        leekwarsDir,
        folderInfo.id,
        folders
      );

      // Get or create the folder entry
      const existingFolder = this.state.folders.get(folderId);

      if (fs.existsSync(folderPath)) {
        // Folder exists locally - update local state (without saving yet)
        const stats = fs.statSync(folderPath);
        const localState: LocalFolderState = {
          absolutePath: folderPath,
          relativePath: path.relative(workspaceRoot, folderPath),
          lastModified: stats.mtimeMs,
        };

        if (existingFolder) {
          existingFolder.local = localState;
          existingFolder.leekwars = leekwarsState;
          existingFolder.parentFolderId = parentFolderId;
        } else {
          this.state.folders.set(folderId, {
            id: folderId,
            local: localState,
            leekwars: leekwarsState,
            analyzer: null,
            parentFolderId,
          });
        }
      } else {
        // Folder doesn't exist locally - create/update entry with LeekWars state only
        if (!existingFolder) {
          this.state.folders.set(folderId, {
            id: folderId,
            local: null,
            leekwars: leekwarsState,
            analyzer: null,
            parentFolderId,
          });
        } else {
          // Update existing entry
          existingFolder.leekwars = leekwarsState;
          existingFolder.parentFolderId = parentFolderId;
        }
      }
    }

    // Update files
    for (const aiInfo of ais) {
      const leekwarsState: LeekWarsFileState = {
        id: aiInfo.id,
        name: aiInfo.name,
        folderId: aiInfo.folder,
        version: aiInfo.version,
        valid: aiInfo.valid,
        lastSyncTime: Date.now(),
      };

      // Construct file path
      const folderPath =
        aiInfo.folder === 0
          ? leekwarsDir
          : this.constructFolderPath(leekwarsDir, aiInfo.folder, folders);
      const filePath = path.join(folderPath, aiInfo.name);

      // Get or create the file entry
      const existingFile = this.state.files.get(filePath);

      if (fs.existsSync(filePath)) {
        // File exists locally - update local state (without saving yet)
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf8");
        const hash = crypto.createHash("md5").update(content).digest("hex");

        const localState: LocalFileState = {
          absolutePath: filePath,
          relativePath: path.relative(workspaceRoot, filePath),
          size: stats.size,
          lastModified: stats.mtimeMs,
          contentHash: hash,
        };

        if (existingFile) {
          existingFile.local = localState;
          existingFile.leekwars = leekwarsState;
        } else {
          this.state.files.set(filePath, {
            local: localState,
            leekwars: leekwarsState,
            analyzer: null,
            parentFolderId: `leekwars-${aiInfo.folder}`,
          });
        }
      } else {
        // File doesn't exist locally - create/update entry with LeekWars state only
        if (!existingFile) {
          this.state.files.set(filePath, {
            local: null,
            leekwars: leekwarsState,
            analyzer: null,
            parentFolderId: `leekwars-${aiInfo.folder}`,
          });
        } else {
          // Update existing entry
          existingFile.leekwars = leekwarsState;
        }
      }
    }

    this.state.lastFullSync = Date.now();

    // Save once after all updates to reduce I/O
    await this.saveState();

    console.log(
      `[CodeBaseState] Synced ${folders.length} folders and ${ais.length} files from LeekWars`
    );
  }

  /**
   * Construct folder path from LeekWars folder ID
   */
  private constructFolderPath(
    baseDir: string,
    folderId: number,
    folders: Array<{ id: number; name: string; folder: number }>
  ): string {
    if (folderId === 0) {
      return baseDir;
    }

    const folder = folders.find((f) => f.id === folderId);
    if (!folder) {
      return baseDir;
    }

    const parentPath = this.constructFolderPath(
      baseDir,
      folder.folder,
      folders
    );
    return path.join(parentPath, folder.name);
  }

  /**
   * Scan local workspace and update state
   */
  async scanLocalWorkspace(
    workspaceRoot: string,
    leekwarsDir: string
  ): Promise<void> {
    if (!fs.existsSync(leekwarsDir)) {
      console.log("[CodeBaseState] LeekWars directory does not exist");
      return;
    }

    await this.scanDirectory(leekwarsDir, workspaceRoot, null);
    await this.saveState();
  }

  /**
   * Recursively scan a directory
   */
  private async scanDirectory(
    dirPath: string,
    workspaceRoot: string,
    parentFolderId: string | null
  ): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const folderId = `local-${fullPath}`;
        await this.updateFolderLocalState(
          folderId,
          fullPath,
          workspaceRoot,
          parentFolderId
        );
        await this.scanDirectory(fullPath, workspaceRoot, folderId);
      } else if (entry.isFile() && entry.name.endsWith(".leek")) {
        await this.updateFileLocalState(fullPath, workspaceRoot);
      }
    }
  }

  // ==================== Query Operations ====================

  /**
   * Get files with specific sync status
   */
  getFilesBySyncStatus(status: SyncStatus): CodeBaseFile[] {
    const files: CodeBaseFile[] = [];
    for (const file of this.state.files.values()) {
      if (CodeBaseStateHelpers.getFileSyncStatus(file) === status) {
        files.push(file);
      }
    }
    return files;
  }

  /**
   * Get statistics about the codebase
   */
  getStatistics() {
    const totalFiles = this.state.files.size;
    const totalFolders = this.state.folders.size;

    let filesWithLeekWars = 0;
    let filesWithAnalyzer = 0;
    let filesInSync = 0;
    let filesLocalOnly = 0;
    let filesRemoteOnly = 0;

    for (const file of this.state.files.values()) {
      if (file.leekwars) filesWithLeekWars++;
      if (file.analyzer) filesWithAnalyzer++;

      const status = CodeBaseStateHelpers.getFileSyncStatus(file);
      if (status === SyncStatus.InSync) filesInSync++;
      if (status === SyncStatus.LocalOnly) filesLocalOnly++;
      if (status === SyncStatus.RemoteOnly) filesRemoteOnly++;
    }

    return {
      totalFiles,
      totalFolders,
      filesWithLeekWars,
      filesWithAnalyzer,
      filesInSync,
      filesLocalOnly,
      filesRemoteOnly,
      lastFullSync: this.state.lastFullSync,
      ownerId: this.state.ownerId,
    };
  }
}
