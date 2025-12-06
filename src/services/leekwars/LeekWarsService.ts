import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  LeekWarsApiService,
  LeekWarsAIInfo,
  GetFarmerAIsResponse,
} from "./LeekWarsApi";
import { CodeBaseStateManager } from "../codebase";
import { LocalFilesService } from "../local-files/LocalFilesService";
import {
  FileNode,
  FolderNode,
  LocalFilesState,
} from "../local-files/LocalFilesService.types";

/**
 * Service for managing LeekWars AI synchronization
 */
export class LeekWarsService {
  private apiService: LeekWarsApiService | null = null;
  private lastResponse: GetFarmerAIsResponse | null = null;
  private static readonly STORAGE_KEY = "leekwars.farmerAIsResponse";
  private codebaseStateManager: CodeBaseStateManager | null = null;

  constructor(private context: vscode.ExtensionContext) {
    // Load cached response on initialization
    this.loadFarmerAIsResponse();
  }

  /**
   * Set the codebase state manager
   */
  setCodeBaseStateManager(manager: CodeBaseStateManager): void {
    this.codebaseStateManager = manager;
  }

  /**
   * Store the GetFarmerAIsResponse object to persist across sessions
   */
  async storeFarmerAIsResponse(response: GetFarmerAIsResponse): Promise<void> {
    try {
      this.lastResponse = response;
      await this.context.globalState.update(
        LeekWarsService.STORAGE_KEY,
        response
      );
      console.log(
        "[LeekWars Service] Stored farmer AIs response to persistent storage"
      );
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to store farmer AIs response:",
        error
      );
      vscode.window.showErrorMessage(
        `Failed to store AI data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Load the GetFarmerAIsResponse object from persistent storage
   */
  private loadFarmerAIsResponse(): void {
    try {
      const stored = this.context.globalState.get<GetFarmerAIsResponse>(
        LeekWarsService.STORAGE_KEY
      );
      if (stored) {
        this.lastResponse = stored;
        console.log(
          "[LeekWars Service] Loaded farmer AIs response from persistent storage"
        );
      }
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to load farmer AIs response:",
        error
      );
    }
  }

  /**
   * Get the currently stored GetFarmerAIsResponse object
   */
  getStoredFarmerAIsResponse(): GetFarmerAIsResponse | null {
    return this.lastResponse;
  }

  /**
   * Clear the stored GetFarmerAIsResponse object
   */
  async clearStoredFarmerAIsResponse(): Promise<void> {
    try {
      this.lastResponse = null;
      await this.context.globalState.update(
        LeekWarsService.STORAGE_KEY,
        undefined
      );
      console.log("[LeekWars Service] Cleared stored farmer AIs response");
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to clear farmer AIs response:",
        error
      );
    }
  }

  /**
   * Check if the API token is configured
   * @returns true if token is configured, false otherwise
   */
  isTokenConfigured(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Check if token is configured and show a warning notification if not
   * @returns true if token is configured, false otherwise
   */
  async checkTokenAndNotify(): Promise<boolean> {
    const hasToken = this.isTokenConfigured();

    if (!hasToken) {
      const configureButton = "Configure Token";
      const result = await vscode.window.showWarningMessage(
        "LeekWars API token is not configured. Remote requests will not work.",
        configureButton
      );

      if (result === configureButton) {
        // Open settings to the specific setting
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "leekscript.leekwarsApiToken"
        );
      }
    }

    return hasToken;
  }

  /**
   * Get the API token from settings
   */
  private getToken(): string | null {
    const config = vscode.workspace.getConfiguration("leekscript");
    const token = config.get<string>("leekwarsApiToken", "");
    return token || null;
  }

  /**
   * Initialize the API service with the current token
   */
  private initializeApi(): boolean {
    const token = this.getToken();
    if (!token) {
      vscode.window.showErrorMessage(
        "LeekWars API token not configured. Please set it in settings."
      );
      return false;
    }

    this.apiService = new LeekWarsApiService(token);
    return true;
  }

  /**
   * Find folders that exist in remote but not in local
   */
  private findMissingFolders(
    remote: (FolderNode | FileNode)[],
    local: (FolderNode | FileNode)[]
  ): FolderNode[] {
    const missingFolders: FolderNode[] = [];

    // Create a map of local folder names for quick lookup
    const localFolderMap = new Map<string, FolderNode>();
    for (const node of local) {
      if (node.type === "folder") {
        localFolderMap.set(node.name, node as FolderNode);
      }
    }

    // Check each remote folder
    for (const remoteNode of remote) {
      if (remoteNode.type === "folder") {
        const remoteFolder = remoteNode as FolderNode;
        const localFolder = localFolderMap.get(remoteFolder.name);

        if (!localFolder) {
          // Folder doesn't exist locally
          missingFolders.push(remoteFolder);
        } else {
          // Folder exists, recursively check children
          const missingSubFolders = this.findMissingFolders(
            remoteFolder.children,
            localFolder.children
          );
          missingFolders.push(...missingSubFolders);
        }
      }
    }

    return missingFolders;
  }

  /**
   * Find files that exist in remote but not in local
   */
  private findMissingFiles(
    remote: (FolderNode | FileNode)[],
    local: (FolderNode | FileNode)[]
  ): FileNode[] {
    const missingFiles: FileNode[] = [];

    // Create a map of local file names for quick lookup
    const localFileMap = new Map<string, FileNode>();
    const localFolderMap = new Map<string, FolderNode>();

    for (const node of local) {
      if (node.type === "file") {
        localFileMap.set(node.name, node as FileNode);
      } else if (node.type === "folder") {
        localFolderMap.set(node.name, node as FolderNode);
      }
    }

    // Check each remote node
    for (const remoteNode of remote) {
      if (remoteNode.type === "file") {
        const remoteFile = remoteNode as FileNode;

        if (!localFileMap.has(remoteFile.name)) {
          // File doesn't exist locally
          missingFiles.push(remoteFile);
        }
      } else if (remoteNode.type === "folder") {
        const remoteFolder = remoteNode as FolderNode;
        const localFolder = localFolderMap.get(remoteFolder.name);

        if (localFolder) {
          // Folder exists, recursively check children
          const missingSubFiles = this.findMissingFiles(
            remoteFolder.children,
            localFolder.children
          );
          missingFiles.push(...missingSubFiles);
        }
        // If folder doesn't exist locally, all its files are implicitly missing
        // but we already capture this through findMissingFolders
      }
    }

    return missingFiles;
  }

  /**
   * Find folders that exist in local but not in remote
   */
  private findNewFolders(
    local: (FolderNode | FileNode)[],
    remote: (FolderNode | FileNode)[]
  ): FolderNode[] {
    const newFolders: FolderNode[] = [];

    // Create a map of remote folder names for quick lookup
    const remoteFolderMap = new Map<string, FolderNode>();
    for (const node of remote) {
      if (node.type === "folder") {
        remoteFolderMap.set(node.name, node as FolderNode);
      }
    }

    // Check each local folder
    for (const localNode of local) {
      if (localNode.type === "folder") {
        const localFolder = localNode as FolderNode;
        const remoteFolder = remoteFolderMap.get(localFolder.name);

        if (!remoteFolder) {
          // Folder doesn't exist remotely - add it and all its subfolders
          newFolders.push(localFolder);
          // Recursively collect all subfolders within this new folder
          const allSubFolders = this.collectAllSubFolders(localFolder);
          newFolders.push(...allSubFolders);
        } else {
          // Folder exists, recursively check children
          const newSubFolders = this.findNewFolders(
            localFolder.children,
            remoteFolder.children
          );
          newFolders.push(...newSubFolders);
        }
      }
    }

    return newFolders;
  }

  /**
   * Find files that exist in local but not in remote
   */
  private findNewFiles(
    local: (FolderNode | FileNode)[],
    remote: (FolderNode | FileNode)[]
  ): FileNode[] {
    const newFiles: FileNode[] = [];

    // Create maps for remote files and folders
    const remoteFileMap = new Map<string, FileNode>();
    const remoteFolderMap = new Map<string, FolderNode>();

    for (const node of remote) {
      if (node.type === "file") {
        remoteFileMap.set(node.name, node as FileNode);
      } else if (node.type === "folder") {
        remoteFolderMap.set(node.name, node as FolderNode);
      }
    }

    // Check each local node
    for (const localNode of local) {
      if (localNode.type === "file") {
        const localFile = localNode as FileNode;

        if (!remoteFileMap.has(localFile.name)) {
          // File doesn't exist remotely
          newFiles.push(localFile);
        }
      } else if (localNode.type === "folder") {
        const localFolder = localNode as FolderNode;
        const remoteFolder = remoteFolderMap.get(localFolder.name);

        if (remoteFolder) {
          // Folder exists, recursively check children
          const newSubFiles = this.findNewFiles(
            localFolder.children,
            remoteFolder.children
          );
          newFiles.push(...newSubFiles);
        }
        // If folder doesn't exist remotely, its files will be handled
        // after the folder is created in step 3
      }
    }

    return newFiles;
  }

  /**
   * Recursively collect all subfolders from a folder
   */
  private collectAllSubFolders(folder: FolderNode): FolderNode[] {
    const subFolders: FolderNode[] = [];

    for (const child of folder.children) {
      if (child.type === "folder") {
        const childFolder = child as FolderNode;
        subFolders.push(childFolder);
        // Recursively collect subfolders of this subfolder
        const nestedSubFolders = this.collectAllSubFolders(childFolder);
        subFolders.push(...nestedSubFolders);
      }
    }

    return subFolders;
  }

  /**
   * Get farmers AI file state
   */
  async getFarmersAIFileState(): Promise<(FolderNode | FileNode)[] | null> {
    if (!this.initializeApi() || !this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return null;
    }

    try {
      // pull all AIs to get the latest data in lastResponse
      const farmerAIs = await this.apiService.getFarmerAIs();
      // Store the response for later use and persist it
      await this.storeFarmerAIsResponse(farmerAIs);

      const localFilesService = LocalFilesService.getInstance();
      const farmerAIFileState =
        localFilesService.farmersAIToLocalFileState(farmerAIs);

      return farmerAIFileState.root[0].children;
    } catch (error) {
      console.error(
        "[LeekWars Service] Error getting farmer AI file state:",
        error
      );
      return null;
    }
  }

  /**
   * Push local changes to LeekWars (Force sync all)
   * Synchronizes folder structure, files, and code content
   */
  async pushToLeekwars(): Promise<void> {
    if (!this.initializeApi() || !this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    try {
      // Fetch remote and local state
      const { localFilesRoot, remoteFilesRoot, workspaceRoot } =
        await this.fetchSyncStates();

      if (!remoteFilesRoot) {
        return;
      }

      // Step 1: Synchronize folder and file structure
      await this.syncFolderStructure(
        localFilesRoot,
        remoteFilesRoot,
        workspaceRoot
      );

      // Step 2: Determine which files need content updates
      // TODO: In the future, this will be optimized to only check files that changed locally
      // by comparing with the last pushed state, instead of fetching all remote AI codes
      const filesToUpdate = await this.findFilesNeedingUpdate(
        localFilesRoot,
        remoteFilesRoot,
        workspaceRoot
      );

      if (filesToUpdate.length === 0) {
        console.log("No files need to be updated");
        vscode.window.showInformationMessage(
          "All files are synchronized with LeekWars"
        );
        return;
      }

      // Step 3: Update file contents
      const { successCount, failureCount } = await this.updateFileContents(
        filesToUpdate
      );

      // Step 4: Trigger recompilation of main AIs that include updated files
      const { recompileSuccessCount, recompileFailureCount } =
        await this.triggerMainAIRecompilation(filesToUpdate, remoteFilesRoot);

      // Report results
      this.reportSyncResults(
        successCount,
        failureCount,
        recompileSuccessCount,
        recompileFailureCount
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to push to LeekWars: ${error.message}`
      );
    }
  }

  /**
   * Fetch and prepare local and remote file states for synchronization
   */
  private async fetchSyncStates(): Promise<{
    localFilesRoot: (FolderNode | FileNode)[];
    remoteFilesRoot: (FolderNode | FileNode)[] | null;
    workspaceRoot: string;
  }> {
    // Fetch remote state
    const farmerAIs = await this.apiService!.getFarmerAIs();
    await this.storeFarmerAIsResponse(farmerAIs);

    // Fetch local state
    const localFilesService = LocalFilesService.getInstance();
    const localFilesState = await localFilesService.getLocalFilesState();
    const localFilesRoot = localFilesState.root[0].children;

    console.log("Local Files State:", localFilesRoot);

    // Convert remote state to file tree structure
    const remoteFilesRoot = await this.getFarmersAIFileState();

    if (!remoteFilesRoot) {
      console.error("[LeekWars Service] Failed to get farmer's AI file state");
      vscode.window.showErrorMessage("Failed to fetch remote AI state");
      return { localFilesRoot, remoteFilesRoot: null, workspaceRoot: "" };
    }

    console.log("Remote Files State:", remoteFilesRoot);

    // Get workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.error("[LeekWars Service] No workspace folder found");
      throw new Error("No workspace folder found");
    }

    return {
      localFilesRoot,
      remoteFilesRoot,
      workspaceRoot: workspaceFolder.uri.fsPath,
    };
  }

  /**
   * Synchronize folder and file structure (delete obsolete, create new)
   */
  private async syncFolderStructure(
    localFilesRoot: (FolderNode | FileNode)[],
    remoteFilesRoot: (FolderNode | FileNode)[],
    workspaceRoot: string
  ): Promise<void> {
    // Delete remote folders that don't exist locally
    await this.deleteObsoleteFolders(remoteFilesRoot, localFilesRoot);

    // Delete remote files that don't exist locally
    await this.deleteObsoleteFiles(remoteFilesRoot, localFilesRoot);

    // Create folders that exist locally but not remotely
    await this.createNewFolders(localFilesRoot, remoteFilesRoot);

    // Create files that exist locally but not remotely
    await this.createNewFiles(localFilesRoot, remoteFilesRoot);
  }

  /**
   * Delete folders from remote that don't exist locally
   */
  private async deleteObsoleteFolders(
    remoteFilesRoot: (FolderNode | FileNode)[],
    localFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    const missingFolders = this.findMissingFolders(
      remoteFilesRoot,
      localFilesRoot
    );

    console.log(`Deleting ${missingFolders.length} obsolete remote folder(s)`);

    for (const folder of missingFolders) {
      if (folder.leekWarsFolderInfo) {
        console.log(
          `Deleting remote folder: ${folder.leekWarsFolderInfo.name} (ID: ${folder.leekWarsFolderInfo.id})`
        );
        await this.rateLimitedDelay();
        await this.apiService!.deleteFolder(folder.leekWarsFolderInfo.id);
      }
    }
  }

  /**
   * Delete files from remote that don't exist locally
   */
  private async deleteObsoleteFiles(
    remoteFilesRoot: (FolderNode | FileNode)[],
    localFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    const missingFiles = this.findMissingFiles(remoteFilesRoot, localFilesRoot);

    console.log(`Deleting ${missingFiles.length} obsolete remote file(s)`);

    for (const file of missingFiles) {
      if (file.leekWarsAIInfo) {
        console.log(
          `Deleting remote AI: ${file.leekWarsAIInfo.name} (ID: ${file.leekWarsAIInfo.id})`
        );
        await this.rateLimitedDelay();
        await this.apiService!.deleteAI(file.leekWarsAIInfo.id);
      }
    }
  }

  /**
   * Create folders on remote that exist locally but not remotely
   */
  private async createNewFolders(
    localFilesRoot: (FolderNode | FileNode)[],
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    const newFolders = this.findNewFolders(localFilesRoot, remoteFilesRoot);

    console.log(`Creating ${newFolders.length} new remote folder(s)`);

    for (const newFolder of newFolders) {
      await this.createRemoteFolder(newFolder, remoteFilesRoot);
      // Refresh remote state after each folder creation to get updated IDs
      await this.rateLimitedDelay();
      const updatedRemoteState = await this.getFarmersAIFileState();
      if (updatedRemoteState) {
        remoteFilesRoot.length = 0;
        remoteFilesRoot.push(...updatedRemoteState);
      }
    }
  }

  /**
   * Create a single folder on remote
   */
  private async createRemoteFolder(
    folder: FolderNode,
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    console.log(
      `Creating remote folder: ${folder.name} (path: ${folder.path})`
    );

    const isRoot = this.isRootLocalFolder(folder.path);
    const parentFolderId = isRoot
      ? 0
      : await this.getRemoteParentFolderId(folder.path, remoteFilesRoot);

    if (parentFolderId === null && !isRoot) {
      console.error(
        `Cannot create folder ${folder.name}: parent folder not found`
      );
      return;
    }

    await this.rateLimitedDelay();
    const newRemoteFolder = await this.apiService!.createFolder(
      folder.name,
      parentFolderId ?? 0
    );
    console.log(`Created remote folder with ID: ${newRemoteFolder.id}`);
  }

  /**
   * Get the remote parent folder ID for a given local path
   */
  private async getRemoteParentFolderId(
    localPath: string,
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<number | null> {
    const parts = this.getPathParts(localPath);
    const parentPath = parts.slice(0, -1).join(path.sep);

    const parentFolder = this.findFolderByPath(remoteFilesRoot, parentPath);

    if (!parentFolder?.leekWarsFolderInfo) {
      console.error(
        `Parent folder not found in remote state for path: ${parentPath}`
      );
      return null;
    }

    return parentFolder.leekWarsFolderInfo.id;
  }

  /**
   * Create files on remote that exist locally but not remotely
   */
  private async createNewFiles(
    localFilesRoot: (FolderNode | FileNode)[],
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    // Refresh remote state to get updated folder IDs
    const updatedRemoteState = await this.getFarmersAIFileState();
    if (!updatedRemoteState) {
      console.error("[LeekWars Service] Failed to refresh remote state");
      return;
    }

    const newFiles = this.findNewFiles(localFilesRoot, updatedRemoteState);

    console.log(`Creating ${newFiles.length} new remote file(s)`);

    for (const newFile of newFiles) {
      await this.createRemoteFile(newFile, updatedRemoteState);
    }
  }

  /**
   * Create a single file on remote
   */
  private async createRemoteFile(
    file: FileNode,
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<void> {
    console.log(`Creating remote AI: ${file.name} (path: ${file.path})`);

    const isRoot = this.isRootLocalFolder(file.path);
    const folderId = isRoot
      ? 0
      : await this.getRemoteParentFolderId(file.path, remoteFilesRoot);

    if (folderId === null && !isRoot) {
      console.error(`Cannot create file ${file.name}: parent folder not found`);
      return;
    }

    await this.rateLimitedDelay();

    try {
      const newAI = await this.apiService!.createAI({
        folder_id: folderId ?? 0,
        name: file.name,
      });
      console.log(`Created remote AI with ID: ${newAI.id}`);
    } catch (error) {
      console.error(`Error creating AI ${file.name}:`, error);
    }
  }

  /**
   * Find files that need content updates by comparing local and remote code
   * TODO: Optimize this by comparing with last pushed state instead of fetching all remote codes
   */
  private async findFilesNeedingUpdate(
    localFilesRoot: (FolderNode | FileNode)[],
    remoteFilesRoot: (FolderNode | FileNode)[],
    workspaceRoot: string
  ): Promise<
    Array<{
      localFile: FileNode;
      remoteFile: FileNode;
      localCode: string;
    }>
  > {
    // Refresh remote state to ensure all files are present with correct IDs
    await this.rateLimitedDelay();
    const updatedRemoteState = await this.getFarmersAIFileState();
    if (!updatedRemoteState) {
      console.error("[LeekWars Service] Failed to refresh remote state");
      return [];
    }

    const allLocalFiles = this.collectAllFiles(localFilesRoot);
    console.log(`Comparing ${allLocalFiles.length} local file(s) with remote`);

    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Comparing local and remote AI files",
        cancellable: false,
      },
      async (progress) => {
        const filesToUpdate: Array<{
          localFile: FileNode;
          remoteFile: FileNode;
          localCode: string;
        }> = [];

        const totalFiles = allLocalFiles.length;

        for (let i = 0; i < totalFiles; i++) {
          const localFile = allLocalFiles[i];

          progress.report({
            message: `Comparing ${localFile.name} (${i + 1}/${totalFiles})...`,
            increment: 100 / totalFiles,
          });

          const remoteFile = this.findFileByPath(
            updatedRemoteState,
            localFile.path
          );

          if (!remoteFile?.leekWarsAIInfo) {
            console.warn(`Remote file not found for: ${localFile.path}`);
            continue;
          }

          // Read local code
          const localFilePath = path.join(workspaceRoot, localFile.path);
          let localCode: string;
          try {
            localCode = fs.readFileSync(localFilePath, "utf8");
          } catch (error) {
            console.error(`Failed to read local file ${localFilePath}:`, error);
            continue;
          }

          // Fetch remote code
          console.log(
            `Fetching remote code for ${remoteFile.name} (ID: ${remoteFile.leekWarsAIInfo.id})`
          );
          await this.rateLimitedDelay(100); // Shorter delay for read operations

          let remoteAI;
          try {
            remoteAI = await this.apiService!.getAI(
              remoteFile.leekWarsAIInfo.id
            );
          } catch (error) {
            console.error(
              `Failed to fetch remote AI ${remoteFile.leekWarsAIInfo.id}:`,
              error
            );
            continue;
          }

          if (!remoteAI.ai) {
            console.warn(`Could not get remote AI ${remoteFile.name}`);
            continue;
          }

          // Compare codes
          if (localCode !== remoteAI.ai.code) {
            console.log(`Code differs for ${localFile.name} - needs update`);
            filesToUpdate.push({ localFile, remoteFile, localCode });
          } else {
            console.log(
              `Code matches for ${localFile.name} - no update needed`
            );
          }
        }

        console.log(
          `Found ${filesToUpdate.length} file(s) needing update:`,
          filesToUpdate.map((f) => f.localFile.name)
        );

        return filesToUpdate;
      }
    );
  }

  /**
   * Update file contents on remote
   */
  private async updateFileContents(
    filesToUpdate: Array<{
      localFile: FileNode;
      remoteFile: FileNode;
      localCode: string;
    }>
  ): Promise<{ successCount: number; failureCount: number }> {
    console.log(`Updating ${filesToUpdate.length} file(s) on LeekWars`);

    let successCount = 0;
    let failureCount = 0;

    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Updating AI files on LeekWars",
        cancellable: false,
      },
      async (progress) => {
        const totalFiles = filesToUpdate.length;

        for (let i = 0; i < totalFiles; i++) {
          const { remoteFile, localCode } = filesToUpdate[i];

          if (!remoteFile.leekWarsAIInfo) {
            console.error(`Remote file ${remoteFile.name} has no AI info`);
            failureCount++;
            continue;
          }

          const aiId = remoteFile.leekWarsAIInfo.id;

          progress.report({
            message: `Updating ${remoteFile.name} (${i + 1}/${totalFiles})...`,
            increment: 100 / totalFiles,
          });

          console.log(`Updating ${remoteFile.name} (ID: ${aiId})`);

          await this.rateLimitedDelay();

          try {
            await this.apiService!.updateAICode(aiId, localCode);
            console.log(`Successfully updated ${remoteFile.name}`);
            successCount++;
          } catch (error) {
            console.error(`Error updating ${remoteFile.name}:`, error);
            failureCount++;
          }
        }

        console.log(
          `Update complete: ${successCount} succeeded, ${failureCount} failed`
        );

        return { successCount, failureCount };
      }
    );
  }

  /**
   * Trigger recompilation of main AIs that include updated files
   * This works around a LeekWars bug where included files don't trigger automatic recompilation
   */
  private async triggerMainAIRecompilation(
    filesToUpdate: Array<{
      localFile: FileNode;
      remoteFile: FileNode;
      localCode: string;
    }>,
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Promise<{ recompileSuccessCount: number; recompileFailureCount: number }> {
    const mainAIsToSave = this.collectMainAIsForUpdatedFiles(
      filesToUpdate,
      remoteFilesRoot
    );

    if (mainAIsToSave.size === 0) {
      console.log("No main AIs need recompilation");
      return { recompileSuccessCount: 0, recompileFailureCount: 0 };
    }

    console.log(
      `Triggering recompilation for ${
        mainAIsToSave.size
      } main AI(s): ${Array.from(mainAIsToSave).join(", ")}`
    );

    let recompileSuccessCount = 0;
    let recompileFailureCount = 0;

    for (const aiId of mainAIsToSave) {
      const aiFile = this.findFileByAIId(remoteFilesRoot, aiId);

      if (!aiFile) {
        console.warn(`Could not find file for AI ID ${aiId}`);
        continue;
      }

      console.log(`Triggering recompilation for ${aiFile.name} (ID: ${aiId})`);

      await this.rateLimitedDelay();

      try {
        const aiResponse = await this.apiService!.getAI(aiId);

        if (!aiResponse.ai) {
          console.error(`Failed to get AI ${aiFile.name} for recompilation`);
          recompileFailureCount++;
          continue;
        }

        // Re-save the AI to trigger recompilation
        await this.apiService!.updateAICode(aiId, aiResponse.ai.code);
        console.log(`Successfully triggered recompilation for ${aiFile.name}`);
        recompileSuccessCount++;
      } catch (error) {
        console.error(
          `Error triggering recompilation for ${aiFile.name}:`,
          error
        );
        recompileFailureCount++;
      }
    }

    console.log(
      `Recompilation complete: ${recompileSuccessCount} succeeded, ${recompileFailureCount} failed`
    );

    return { recompileSuccessCount, recompileFailureCount };
  }

  /**
   * Collect all main AIs (not included by others) that need recompilation
   */
  private collectMainAIsForUpdatedFiles(
    filesToUpdate: Array<{
      localFile: FileNode;
      remoteFile: FileNode;
      localCode: string;
    }>,
    remoteFilesRoot: (FolderNode | FileNode)[]
  ): Set<number> {
    const mainAIsToSave = new Set<number>();

    for (const { remoteFile } of filesToUpdate) {
      if (!remoteFile.leekWarsAIInfo) {
        continue;
      }

      const entrypoints = remoteFile.leekWarsAIInfo.entrypoints || [];

      if (entrypoints.length > 0) {
        console.log(
          `File ${remoteFile.name} is included by ${
            entrypoints.length
          } AI(s): ${entrypoints.join(", ")}`
        );

        for (const entrypointId of entrypoints) {
          const mainAIs = this.findMainAIsForEntrypoint(
            entrypointId,
            remoteFilesRoot
          );
          mainAIs.forEach((id: number) => mainAIsToSave.add(id));
        }
      }
    }

    return mainAIsToSave;
  }

  /**
   * Report synchronization results to the user
   */
  private reportSyncResults(
    successCount: number,
    failureCount: number,
    recompileSuccessCount: number,
    recompileFailureCount: number
  ): void {
    const totalFailures = failureCount + recompileFailureCount;

    if (recompileSuccessCount > 0) {
      if (totalFailures > 0) {
        vscode.window.showWarningMessage(
          `Updated ${successCount} file(s) and triggered recompilation for ${recompileSuccessCount} main AI(s), but ${totalFailures} operation(s) failed.`
        );
      } else {
        vscode.window.showInformationMessage(
          `Successfully updated ${successCount} file(s) and triggered recompilation for ${recompileSuccessCount} main AI(s)`
        );
      }
    } else {
      if (failureCount > 0) {
        vscode.window.showWarningMessage(
          `Updated ${successCount} file(s), but ${failureCount} failed. Check console for details.`
        );
      } else {
        vscode.window.showInformationMessage(
          `Successfully updated ${successCount} file(s) on LeekWars`
        );
      }
    }
  }

  /**
   * Rate-limited delay to avoid API throttling
   */
  private async rateLimitedDelay(ms: number = 200): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns true if the folder is at the root level (i.e., has no parent folders)
   */
  private isRootLocalFolder(folderPath: string): boolean {
    const parts = this.getPathParts(folderPath);
    console.log("Local folder path parts:", parts);
    return parts.length === 1;
  }

  /**
   * Return parts of a path as an array
   */
  private getPathParts(folderPath: string): string[] {
    return folderPath.split(path.sep).filter((part) => part.length > 0);
  }

  /**
   * Find a file by its AI ID
   */
  private findFileByAIId(
    nodes: (FolderNode | FileNode)[],
    aiId: number
  ): FileNode | null {
    for (const node of nodes) {
      if (node.type === "file") {
        const file = node as FileNode;
        if (file.leekWarsAIInfo && file.leekWarsAIInfo.id === aiId) {
          return file;
        }
      } else if (node.type === "folder") {
        const folder = node as FolderNode;
        const found = this.findFileByAIId(folder.children, aiId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Find main AI files for a given entrypoint ID
   * A main AI is one that has an empty entrypoints array (not included by any other AI)
   */
  private findMainAIsForEntrypoint(
    entrypointId: number,
    nodes: (FolderNode | FileNode)[]
  ): number[] {
    const mainAIs: number[] = [];

    // Find the file for this entrypoint ID
    const entrypointFile = this.findFileByAIId(nodes, entrypointId);

    if (!entrypointFile || !entrypointFile.leekWarsAIInfo) {
      return mainAIs;
    }

    const entrypointInfo = entrypointFile.leekWarsAIInfo;

    // Check if this is a main AI (not included by anyone)
    if (
      !entrypointInfo.entrypoints ||
      entrypointInfo.entrypoints.length === 0
    ) {
      // This is a main AI
      mainAIs.push(entrypointId);
    } else {
      // This AI is included by others, traverse upwards
      for (const parentId of entrypointInfo.entrypoints) {
        const parentMainAIs = this.findMainAIsForEntrypoint(parentId, nodes);
        mainAIs.push(...parentMainAIs);
      }
    }

    return mainAIs;
  }

  /**
   * Find a folder by its path in the remote file tree
   */
  private findFolderByPath(
    nodes: (FolderNode | FileNode)[],
    targetPath: string
  ): FolderNode | null {
    for (const node of nodes) {
      if (node.type === "folder") {
        const folder = node as FolderNode;
        // Check if this folder matches the target path

        // normalize path syntax
        const targetPathNormalized = targetPath.replace(/\\/g, "/");

        if (folder.path === targetPathNormalized) {
          return folder;
        }
        // Recursively search in children
        const found = this.findFolderByPath(folder.children, targetPath);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Find a file by its path in the file tree
   */
  private findFileByPath(
    nodes: (FolderNode | FileNode)[],
    targetPath: string
  ): FileNode | null {
    for (const node of nodes) {
      if (node.type === "file") {
        const file = node as FileNode;
        // Normalize path syntax for comparison
        const targetPathNormalized = targetPath.replace(/\\/g, "/");
        const filePathNormalized = file.path.replace(/\\/g, "/");

        if (filePathNormalized === targetPathNormalized) {
          return file;
        }
      } else if (node.type === "folder") {
        const folder = node as FolderNode;
        // Recursively search in children
        const found = this.findFileByPath(folder.children, targetPath);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Recursively collect all files from the tree
   */
  private collectAllFiles(nodes: (FolderNode | FileNode)[]): FileNode[] {
    const files: FileNode[] = [];

    for (const node of nodes) {
      if (node.type === "file") {
        files.push(node as FileNode);
      } else if (node.type === "folder") {
        const folder = node as FolderNode;
        const subFiles = this.collectAllFiles(folder.children);
        files.push(...subFiles);
      }
    }

    return files;
  }

  /**
   * Pull all AIs from LeekWars and save them locally
   */
  async pullAllAIs(): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Pulling AIs from LeekWars",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Fetching AI list..." });

          const response = await this.apiService!.getFarmerAIs();

          console.log("[LeekWars Service] getFarmerAIs response:", response);

          if (!response.ais) {
            const errorMsg = response.error || "Failed to fetch AI list";
            console.error("[LeekWars Service] Error:", errorMsg);
            console.error(
              "[LeekWars Service] Full response:",
              JSON.stringify(response, null, 2)
            );
            throw new Error(
              `Failed to fetch AI list: ${errorMsg}. Check Developer Tools Console for details.`
            );
          }

          // Store the response for later use and persist it
          await this.storeFarmerAIsResponse(response);

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

          if (!workspaceFolder) {
            throw new Error("No workspace folder open");
          }

          const workspaceRoot = workspaceFolder.uri.fsPath;
          const leekwarsDir = path.join(workspaceRoot, ".");

          // Create leekwars root directory if it doesn't exist
          if (!fs.existsSync(leekwarsDir)) {
            fs.mkdirSync(leekwarsDir, { recursive: true });
          }

          // Create folder structure
          progress.report({ message: "Creating folder structure..." });
          const folderPaths = this.createFolderStructure(
            leekwarsDir,
            response.folders
          );

          // Create AI files
          progress.report({ message: "Pulling AI files..." });
          const aiInfos = response.ais;

          for (let i = 0; i < aiInfos.length; i++) {
            const aiInfo = aiInfos[i];
            progress.report({
              message: `Pulling ${aiInfo.name} (${i + 1}/${aiInfos.length})...`,
              increment: 100 / aiInfos.length,
            });

            // Add delay to avoid rate limiting (except for the first request)
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // Get the AI code
            const aiResponse = await this.apiService!.getAI(aiInfo.id);

            if (!aiResponse.ai) {
              console.warn(
                `[LeekWars Service] Failed to pull AI: ${aiInfo.name}`,
                aiResponse.error
              );
              continue;
            }

            const ai = aiResponse.ai;

            // Determine the folder path
            const folderPath =
              aiInfo.folder === 0
                ? leekwarsDir
                : folderPaths.get(aiInfo.folder) || leekwarsDir;

            const aiFilePath = path.join(folderPath, ai.name);

            fs.writeFileSync(aiFilePath, ai.code, "utf8");
            console.log(`[LeekWars Service] Created AI file: ${aiFilePath}`);
          }

          // Sync with CodeBaseStateManager if available
          if (this.codebaseStateManager) {
            progress.report({ message: "Resetting codebase state..." });
            await this.codebaseStateManager.clearState();

            progress.report({ message: "Updating codebase state..." });
            await this.codebaseStateManager.syncFromLeekWars(
              response.ais,
              response.folders,
              workspaceRoot,
              leekwarsDir
            );
          }

          vscode.window.showInformationMessage(
            `Successfully pulled ${aiInfos.length} AI(s) from LeekWars`
          );
        }
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to pull AIs: ${error.message}`);
    }
  }

  /**
   * Create the folder structure based on LeekWars folders
   * Returns a map of folder IDs to their paths
   */
  private createFolderStructure(
    baseDir: string,
    folders: Array<{ id: number; name: string; folder: number }>
  ): Map<number, string> {
    // Map folder IDs to their paths
    const folderPaths = new Map<number, string>();
    folderPaths.set(0, baseDir); // Root folder ID 0 maps to base directory

    // Create folders level by level
    let currentLevelFolders = folders.filter((f) => f.folder === 0); // Start with root folders
    let processedFolders = new Set<number>();

    while (currentLevelFolders.length > 0) {
      const nextLevelFolders: typeof folders = [];

      for (const folder of currentLevelFolders) {
        // Get parent path
        const parentPath = folderPaths.get(folder.folder);
        if (!parentPath) {
          console.warn(
            `[LeekWars Service] Parent folder ${folder.folder} not found for ${folder.name}`
          );
          continue;
        }

        // Create current folder path
        const folderPath = path.join(parentPath, folder.name);

        // Create the folder
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
          console.log(`[LeekWars Service] Created folder: ${folderPath}`);
        }

        // Store the path
        folderPaths.set(folder.id, folderPath);
        processedFolders.add(folder.id);

        // Find children for next level
        const children = folders.filter(
          (f) => f.folder === folder.id && !processedFolders.has(f.id)
        );
        nextLevelFolders.push(...children);
      }

      currentLevelFolders = nextLevelFolders;
    }

    return folderPaths;
  }

  /**
   * Pull a specific AI from LeekWars
   */
  async pullAI(aiId: number): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Pulling AI from LeekWars",
          cancellable: false,
        },
        async (progress) => {
          const response = await this.apiService!.getAI(aiId);

          console.log(`[LeekWars Service] getAI(${aiId}) response:`, response);

          if (!response.ai) {
            const errorMsg = response.error || "Failed to fetch AI";
            console.error("[LeekWars Service] Error:", errorMsg);
            throw new Error(
              `Failed to fetch AI: ${errorMsg}. Check Developer Tools Console for details.`
            );
          }

          const ai = response.ai;
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

          if (!workspaceFolder) {
            throw new Error("No workspace folder open");
          }

          const leekwarsDir = path.join(workspaceFolder.uri.fsPath, ".");

          if (!fs.existsSync(leekwarsDir)) {
            fs.mkdirSync(leekwarsDir, { recursive: true });
          }

          const aiFilePath = path.join(leekwarsDir, ai.name);

          // Add metadata as comment at the top
          const metadata = `// LeekWars AI: ${ai.name}\n// AI ID: ${ai.id}\n// Valid: ${ai.valid}\n\n`;
          const content = metadata + ai.code;

          fs.writeFileSync(aiFilePath, content, "utf8");

          vscode.window.showInformationMessage(
            `Successfully pulled AI: ${ai.name}`
          );

          // Open the file
          const document = await vscode.workspace.openTextDocument(aiFilePath);
          await vscode.window.showTextDocument(document);
        }
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to pull AI: ${error.message}`);
    }
  }

  /**
   * Show a quick pick to select and pull an AI
   */
  async selectAndPullAI(): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      const response = await this.apiService!.getFarmerAIs();

      console.log("[LeekWars Service] selectAndPullAI response:", response);

      if (!response.success || !response.ais) {
        const errorMsg = response.error || "Failed to fetch AI list";
        console.error("[LeekWars Service] Error:", errorMsg);
        throw new Error(
          `Failed to fetch AI list: ${errorMsg}. Check Developer Tools Console for details.`
        );
      }

      const aiInfos = response.ais;

      if (aiInfos.length === 0) {
        vscode.window.showInformationMessage(
          "No AIs found on your LeekWars account"
        );
        return;
      }

      const items = aiInfos.map((ai) => ({
        label: ai.name,
        description: `ID: ${ai.id} | ${ai.valid ? "✓ Valid" : "✗ Invalid"}`,
        ai: ai,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an AI to pull from LeekWars",
      });

      if (selected) {
        await this.pullAI(selected.ai.id);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch AI list: ${error.message}`
      );
    }
  }
}
