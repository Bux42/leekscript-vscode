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
   * Get diffs of local AIs against LeekWars versions
   */
  async getAIDiffs(): Promise<void> {
    if (!this.initializeApi() || !this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    try {
      // pull all AIs to get the latest data in lastResponse
      const farmerAIs = await this.apiService.getFarmerAIs();
      // Store the response for later use and persist it
      await this.storeFarmerAIsResponse(farmerAIs);

      const localFilesService = LocalFilesService.getInstance();
      const localFilesState = await localFilesService.getLocalFilesState();

      console.log("Local Files State:", localFilesState.root[0].children);

      let remoteFilesRoot = await this.getFarmersAIFileState();

      if (!remoteFilesRoot) {
        console.error(
          "[LeekWars Service] Failed to get farmer's AI file state"
        );
        return;
      }

      console.log("Farmer's AIs to Local File State:", remoteFilesRoot);

      const localFilesRoot: (FolderNode | FileNode)[] =
        localFilesState.root[0].children;

      /* ---- STEP 1: DELETE REMOTE FOLDERS THAT DON'T EXIST LOCALLY ---- */

      // Find folders that exist in remote but not in local, meaning we removed them / renamed them locally
      const missingFolders = this.findMissingFolders(
        remoteFilesRoot,
        localFilesRoot
      );

      console.log(
        "Missing folders (in remote but not in local):",
        missingFolders
      );

      // Delete missing folders from LeekWars
      for (const folder of missingFolders) {
        if (folder.leekWarsFolderInfo) {
          console.log(
            `Deleting remote folder: ${folder.leekWarsFolderInfo.name} (ID: ${folder.leekWarsFolderInfo.id})`
          );
          // sleep for 200ms to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
          await this.apiService.deleteFolder(folder.leekWarsFolderInfo.id);
        }
      }

      /* ---- STEP 2: DELETE REMOTE FILES THAT DON'T EXIST LOCALLY ---- */

      // Find files that exist in remote but not in local
      const missingFiles = this.findMissingFiles(
        remoteFilesRoot,
        localFilesRoot
      );

      console.log("Missing files (in remote but not in local):", missingFiles);

      // Delete missing files from LeekWars
      for (const file of missingFiles) {
        if (file.leekWarsAIInfo) {
          console.log(
            `Deleting remote AI: ${file.leekWarsAIInfo.name} (ID: ${file.leekWarsAIInfo.id})`
          );
          // sleep for 200ms to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
          await this.apiService.deleteAI(file.leekWarsAIInfo.id);
        }
      }

      /* ---- STEP 3: CREATE FOLDERS THAT EXIST LOCALLY BUT NOT REMOTELY ---- */

      // Find folders that exist locally but not remotely

      const newFolders = this.findNewFolders(localFilesRoot, remoteFilesRoot);

      console.log("New folders (in local but not in remote):", newFolders);

      // Create new folders on LeekWars
      for (const new_local_folder of newFolders) {
        console.log(
          `Creating remote folder: ${new_local_folder.name} with path ${new_local_folder.path}`
        );
        if (this.isRootLocalFolder(new_local_folder.path)) {
          console.log(
            `Creating remote root folder: ${new_local_folder.name} with parent ID 0`
          );
          // sleep for 200ms to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
          const newLeekwarsFolder = await this.apiService.createFolder(
            new_local_folder.name,
            0
          );
          console.log(
            `Created remote root folder with ID: ${newLeekwarsFolder.id}`
          );
        } else {
          // Handle subfolder creation - find parent folder in remote state
          const parts = this.getPathParts(new_local_folder.path);
          console.log("Local folder parts:", parts);

          // The parent folder path is all parts except the last one
          const parentPath = parts.slice(0, -1).join(path.sep);
          console.log("Parent folder path:", parentPath);

          // Find the parent folder in the remote state
          if (!remoteFilesRoot) {
            console.error("Remote files root is null, cannot create subfolder");
            continue;
          }

          const parentRemoteFolder = this.findFolderByPath(
            remoteFilesRoot,
            parentPath
          );

          if (parentRemoteFolder && parentRemoteFolder.leekWarsFolderInfo) {
            const parentFolderId = parentRemoteFolder.leekWarsFolderInfo.id;
            console.log(
              `Creating remote subfolder: ${new_local_folder.name} with parent ID ${parentFolderId}`
            );
            // sleep for 200ms to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200));
            const newLeekwarsFolder = await this.apiService.createFolder(
              new_local_folder.name,
              parentFolderId
            );
            console.log(
              `Created remote subfolder with ID: ${newLeekwarsFolder.id}`
            );
          } else {
            console.error(
              `Parent folder not found in remote state for path: ${parentPath}`
            );
            console.error(
              `Skipping creation of folder: ${new_local_folder.name}`
            );
            continue;
          }
        }
        // update remoteFilesRoot to reflect the new folder structure
        // sleep for 200ms to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
        remoteFilesRoot = await this.getFarmersAIFileState();
      }

      /* ---- STEP 4: CREATE .leek FILES THAT EXIST LOCALLY BUT NOT REMOTELY ---- */

      // Update remote state after folder creation
      remoteFilesRoot = await this.getFarmersAIFileState();

      if (!remoteFilesRoot) {
        console.error(
          "[LeekWars Service] Failed to get updated farmer's AI file state"
        );
        return;
      }

      // Find files that exist locally but not remotely
      const newFiles = this.findNewFiles(localFilesRoot, remoteFilesRoot);

      console.log("New files (in local but not in remote):", newFiles);

      // Create new AI files on LeekWars
      for (const new_local_file of newFiles) {
        console.log(
          `Creating remote AI: ${new_local_file.name} with path ${new_local_file.path}`
        );

        // Determine the folder ID for this file
        let folderId = 0; // Default to root

        if (!this.isRootLocalFolder(new_local_file.path)) {
          // File is in a subfolder - find the parent folder
          const parts = this.getPathParts(new_local_file.path);
          const parentPath = parts.slice(0, -1).join(path.sep);
          console.log("Parent folder path for file:", parentPath);

          if (!remoteFilesRoot) {
            console.error("Remote files root is null, cannot create file");
            continue;
          }

          const parentRemoteFolder = this.findFolderByPath(
            remoteFilesRoot,
            parentPath
          );

          if (parentRemoteFolder && parentRemoteFolder.leekWarsFolderInfo) {
            folderId = parentRemoteFolder.leekWarsFolderInfo.id;
            console.log(`File will be created in folder ID: ${folderId}`);
          } else {
            console.error(
              `Parent folder not found in remote state for path: ${parentPath}`
            );
            console.error(`Skipping creation of file: ${new_local_file.name}`);
            continue;
          }
        }

        // Create the AI file (without .leek extension for the API)

        console.log(
          `Creating remote AI: ${new_local_file.name} in folder ID ${folderId}`
        );

        // sleep for 200ms to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));

        try {
          const newLeekwarsAI = await this.apiService.createAI({
            folder_id: folderId,
            name: new_local_file.name,
          });
          console.log(`Created remote AI with ID: ${newLeekwarsAI.id}`);
        } catch (error) {
          console.error(`Error creating AI ${new_local_file.name}:`, error);
        }
      }

      /* ---- STEP 5: COMPARE CONTENT OF LOCAL AND REMOTE AIs ---- */

      // Update remote state after file creation
      // sleep for 200ms to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
      remoteFilesRoot = await this.getFarmersAIFileState();

      if (!remoteFilesRoot) {
        console.error(
          "[LeekWars Service] Failed to get updated farmer's AI file state after file creation"
        );
        return;
      }

      // Collect all local files (recursively)
      const allLocalFiles = this.collectAllFiles(localFilesRoot);
      console.log(`Found ${allLocalFiles.length} local files to check`);

      // Array to store files that need to be updated
      const filesToUpdate: Array<{
        localFile: FileNode;
        remoteFile: FileNode;
        localCode: string;
        remoteCode: string;
      }> = [];

      // Get workspace root for reading local files
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.error("[LeekWars Service] No workspace folder found");
        return;
      }
      const workspaceRoot = workspaceFolder.uri.fsPath;

      // Check each local file against its remote counterpart
      for (const localFile of allLocalFiles) {
        console.log(`Checking file: ${localFile.name}`);

        // Find the corresponding remote file
        const remoteFile = this.findFileByPath(remoteFilesRoot, localFile.path);

        if (!remoteFile) {
          console.warn(
            `Remote file not found for local file: ${localFile.path}`
          );
          continue;
        }

        if (!remoteFile.leekWarsAIInfo) {
          console.warn(
            `Remote file ${remoteFile.name} has no LeekWars AI info`
          );
          continue;
        }

        // Read local file content
        const localFilePath = path.join(workspaceRoot, localFile.path);
        let localCode: string;
        try {
          localCode = fs.readFileSync(localFilePath, "utf8");
        } catch (error) {
          console.error(`Failed to read local file ${localFilePath}:`, error);
          continue;
        }

        // Get remote AI code
        console.log(
          `Fetching remote AI code for ${remoteFile.name} (ID: ${remoteFile.leekWarsAIInfo.id})`
        );

        // Sleep for 100ms to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));

        let remoteAI;
        try {
          remoteAI = await this.apiService.getAI(remoteFile.leekWarsAIInfo.id);
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

        const remoteCode = remoteAI.ai.code;

        // Compare local and remote code
        if (localCode !== remoteCode) {
          console.log(`Code differs for ${localFile.name} - needs update`);
          filesToUpdate.push({
            localFile,
            remoteFile,
            localCode,
            remoteCode,
          });
        } else {
          console.log(`Code matches for ${localFile.name} - no update needed`);
        }
      }

      console.log(
        "Files to update:",
        filesToUpdate.map((f) => f.localFile.path)
      );

      /* ---- STEP 6: UPDATE REMOTE FILES WITH LOCAL CODE ---- */

      if (filesToUpdate.length === 0) {
        console.log("No files need to be updated");
        vscode.window.showInformationMessage(
          "All files are synchronized with LeekWars"
        );
        return;
      }

      console.log(`Updating ${filesToUpdate.length} file(s) on LeekWars`);

      let successCount = 0;
      let failureCount = 0;

      for (const fileToUpdate of filesToUpdate) {
        const { remoteFile, localCode } = fileToUpdate;

        if (!remoteFile.leekWarsAIInfo) {
          console.error(
            `Remote file ${remoteFile.name} has no LeekWars AI info`
          );
          failureCount++;
          continue;
        }

        const aiId = remoteFile.leekWarsAIInfo.id;
        console.log(
          `Updating remote AI ${remoteFile.name} (ID: ${aiId}) with local code`
        );

        // Sleep for 200ms to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));

        try {
          await this.apiService.updateAICode(aiId, localCode);
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

      /* ---- STEP 7: TRIGGER RECOMPILATION OF MAIN AI FILES ---- */

      // Find all main AI files that include the updated files
      // This is necessary due to a LeekWars bug where included files don't trigger recompilation
      const mainAIsToSave = new Set<number>();

      for (const fileToUpdate of filesToUpdate) {
        const { remoteFile } = fileToUpdate;

        if (!remoteFile.leekWarsAIInfo) {
          continue;
        }

        // Get the entrypoints (AIs that include this file)
        const entrypoints = remoteFile.leekWarsAIInfo.entrypoints || [];

        console.log(
          `File ${remoteFile.name} is included by ${
            entrypoints.length
          } AI(s): ${entrypoints.join(", ")}`
        );

        // Traverse upwards to find main AI files (those with empty entrypoints)
        for (const entrypointId of entrypoints) {
          const mainAIs = this.findMainAIsForEntrypoint(
            entrypointId,
            remoteFilesRoot
          );
          mainAIs.forEach((id: number) => mainAIsToSave.add(id));
        }
      }

      if (mainAIsToSave.size > 0) {
        console.log(
          `Found ${
            mainAIsToSave.size
          } main AI(s) that need to be saved to trigger recompilation: ${Array.from(
            mainAIsToSave
          ).join(", ")}`
        );

        let recompileSuccessCount = 0;
        let recompileFailureCount = 0;

        for (const aiId of mainAIsToSave) {
          // Find the file node for this AI
          const aiFile = this.findFileByAIId(remoteFilesRoot, aiId);

          if (!aiFile) {
            console.warn(`Could not find remote file for AI ID ${aiId}`);
            continue;
          }

          console.log(
            `Triggering recompilation for main AI ${aiFile.name} (ID: ${aiId})`
          );

          // Sleep for 200ms to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));

          try {
            // Get the current code
            const aiResponse = await this.apiService.getAI(aiId);

            if (!aiResponse.ai) {
              console.error(
                `Failed to get AI ${aiFile.name} for recompilation`
              );
              recompileFailureCount++;
              continue;
            }

            // Save it back (this triggers recompilation)
            await this.apiService.updateAICode(aiId, aiResponse.ai.code);
            console.log(
              `Successfully triggered recompilation for ${aiFile.name}`
            );
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
          `Recompilation trigger complete: ${recompileSuccessCount} succeeded, ${recompileFailureCount} failed`
        );

        if (recompileFailureCount > 0) {
          vscode.window.showWarningMessage(
            `Updated ${successCount} file(s) and triggered recompilation for ${recompileSuccessCount} main AI(s), but ${
              failureCount + recompileFailureCount
            } operations failed.`
          );
        } else {
          vscode.window.showInformationMessage(
            `Successfully updated ${successCount} file(s) and triggered recompilation for ${recompileSuccessCount} main AI(s) on LeekWars`
          );
        }
      } else {
        console.log("No main AIs need recompilation");

        if (failureCount > 0) {
          vscode.window.showWarningMessage(
            `Updated ${successCount} file(s) on LeekWars, but ${failureCount} failed. Check console for details.`
          );
        } else {
          vscode.window.showInformationMessage(
            `Successfully updated ${successCount} file(s) on LeekWars`
          );
        }
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to get AI diffs: ${error.message}`
      );
    }
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
