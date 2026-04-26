import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  LeekWarsApiService,
  GetFarmerTreeResponse,
  FarmerTreeFile,
} from "./LeekWarsApi";
import { LocalFilesService } from "../local-files/LocalFilesService";

/**
 * Service for managing LeekWars AI synchronization
 */
export class LeekWarsService {
  private apiService: LeekWarsApiService | null = null;
  private lastFarmerTreeResponse: GetFarmerTreeResponse | null = null;
  private static readonly FARMER_TREE_STORAGE_KEY =
    "leekwars.farmerTreeResponse";

  constructor(private context: vscode.ExtensionContext) {
    // Load cached response on initialization
    this.loadFarmerTreeResponse();
  }

  /**
   * Store the GetFarmerTreeResponse object to persist across sessions
   */
  async storeFarmerTreeResponse(
    response: GetFarmerTreeResponse,
  ): Promise<void> {
    try {
      this.lastFarmerTreeResponse = response;
      await this.context.globalState.update(
        LeekWarsService.FARMER_TREE_STORAGE_KEY,
        response,
      );
      console.log(
        "[LeekWars Service] Stored farmer tree response to persistent storage",
      );
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to store farmer tree response:",
        error,
      );
      vscode.window.showErrorMessage(
        `Failed to store AI data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Load the GetFarmerTreeResponse object from persistent storage
   */
  private loadFarmerTreeResponse(): void {
    try {
      const stored = this.context.globalState.get<GetFarmerTreeResponse>(
        LeekWarsService.FARMER_TREE_STORAGE_KEY,
      );
      if (stored) {
        this.lastFarmerTreeResponse = stored;
        console.log(
          "[LeekWars Service] Loaded farmer tree response from persistent storage",
        );
      }
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to load farmer tree response:",
        error,
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
        configureButton,
      );

      if (result === configureButton) {
        // Open settings to the specific setting
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "leekscript.leekwarsApiToken",
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
        "LeekWars API token not configured. Please set it in settings.",
      );
      return false;
    }

    this.apiService = new LeekWarsApiService(token);
    return true;
  }

  /**
   * Update the API token and reinitialize the API service
   */
  updateApiToken(): boolean {
    const token = this.getToken();
    if (!token) {
      this.apiService = null;
      console.log("[LeekWarsService] API token cleared");
      return false;
    }

    this.apiService = new LeekWarsApiService(token);
    console.log(
      "[LeekWarsService] API token updated and service reinitialized",
    );
    return true;
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
      await this.fetchSyncStates();
    } catch (error: any) {
      console.error("[LeekWars Service] Failed to fetch sync states:", error);
      vscode.window.showErrorMessage(
        `Failed to push to LeekWars: ${error.message}`,
      );
    }
  }

  /**
   * Fetch and prepare local and remote file states for synchronization
   */
  private async fetchSyncStates(): Promise<any> {
    if (!this.initializeApi() || !this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }
    // Fetch remote state

    try {
      const farmerTree = await this.apiService.getFarmerTree();
      this.storeFarmerTreeResponse(farmerTree);
    } catch (error) {
      console.error(
        "[LeekWars Service] Failed to fetch farmer tree from API:",
        error,
      );
      vscode.window.showErrorMessage(
        `Failed to fetch remote AI state: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return;
    }

    if (this.lastFarmerTreeResponse == null) {
      console.error("[LeekWars Service] No farmer tree response available");
      return;
    }

    console.log("Fetched farmer tree from API:", this.lastFarmerTreeResponse);

    // build dictionary file path => file info for remote files
    const remoteFilesMap: Map<string, FarmerTreeFile> =
      this.createFarmerTreeMap(this.lastFarmerTreeResponse.files);
    const remoteFoldersMap: Map<string, string> = this.createPathMap(
      this.lastFarmerTreeResponse.folders,
    );

    // Fetch local state
    const localFilesService = LocalFilesService.getInstance();
    const localFiles: FarmerTreeFile[] | null =
      await localFilesService.getLocalFilesState();

    if (!localFiles) {
      console.error("[LeekWars Service] Failed to fetch local files");
      return;
    }

    // build dictionary file path => file info for local files
    const localFilesMap: Map<string, FarmerTreeFile> =
      this.createFarmerTreeMap(localFiles);
    const localFoldersMap: Map<string, string> =
      this.createLocalFileMap(localFiles);

    // get folders that exist remotely but not locally and should be deleted
    const foldersExistingRemotelyButNotLocally = this.findMissingFolders(
      localFoldersMap,
      remoteFoldersMap,
    );

    console.log(
      "Missing folders (exist remotely but not locally):",
      foldersExistingRemotelyButNotLocally,
    );

    // merge subfolders into their parent folders to avoid redundant delete operations
    const missingRootFolders = this.mergeFolderPathsToRootFolders(
      foldersExistingRemotelyButNotLocally,
    );

    console.log(
      "Grouped folders to delete (after merging subfolders):",
      missingRootFolders,
    );

    // delete folders that exist remotely but not locally
    await this.deleteFoldersByPath(missingRootFolders);

    let fileExistingRemotelyButNotLocally = this.findMissingFiles(
      localFilesMap,
      remoteFilesMap,
    );

    // remove all files that were in a previously deleted folder from fileExistingRemotelyButNotLocally because they are already deleted by the folder delete operation

    fileExistingRemotelyButNotLocally =
      fileExistingRemotelyButNotLocally.filter((filePath) => {
        const isInDeletedFolder = foldersExistingRemotelyButNotLocally.some(
          (folder) => filePath.startsWith(folder + "/"),
        );
        if (isInDeletedFolder) {
          console.log(
            `File ${filePath} is in a folder that is being deleted, skipping individual delete operation for this file.`,
          );
        }
        return !isInDeletedFolder;
      });

    console.log(
      "Missing files (exist remotely but not locally):",
      fileExistingRemotelyButNotLocally,
    );

    // delete files that exist remotely but not locally
    await this.deleteFilesByPath(fileExistingRemotelyButNotLocally);

    const fileExistingLocallyButNotRemotely = this.findMissingFiles(
      remoteFilesMap,
      localFilesMap,
    );

    console.log(
      "Missing files (exist locally but not remotely):",
      fileExistingLocallyButNotRemotely,
    );

    await this.createFilesByPath(fileExistingLocallyButNotRemotely);

    // All folders & files structure should match now, we can proceed to content synchronization
    await this.rateLimitedDelay();
    const farmerTree = await this.apiService.getFarmerTree();
    this.storeFarmerTreeResponse(farmerTree);

    // Update file contents for files that exist both locally and remotely but have different content
    await this.compareFilesAndUpdate(localFiles, farmerTree.files);

    // Store the final remote state
    await this.rateLimitedDelay();
    const farmerTreeUpToDate = await this.apiService.getFarmerTree();
    this.storeFarmerTreeResponse(farmerTreeUpToDate);

    localFilesService.setLocalFileState(farmerTreeUpToDate.files);

    return {
      localFilesRoot: [], // Placeholder, implement fetching local state
      remoteFilesRoot: null,
      workspaceRoot: "workspaceFolder.uri.fsPath",
    };
  }

  private async compareFilesAndUpdate(
    localFiles: FarmerTreeFile[],
    remoteFiles: FarmerTreeFile[],
  ): Promise<void> {
    if (!this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Comparing local and remote: ",
        cancellable: false,
      },
      async (progress) => {
        const workspaceRoot = vscode.workspace.workspaceFolders
          ? vscode.workspace.workspaceFolders[0].uri.fsPath
          : "";

        let successUpdates = 0;
        let failedUpdates = 0;

        for (let i = 0; i < localFiles.length; i++) {
          const localFile = localFiles[i];
          const remoteFile = remoteFiles.find((f) => f.path === localFile.path);
          if (remoteFile) {
            progress.report({
              message: `${i + 1} / ${localFiles.length}: ${localFile.path}`,
              increment: (1 / localFiles.length) * 100,
            });

            if (localFile.mtime === remoteFile.mtime) {
              // console.log(`File is up to date, skipping: ${localFile.path}`);
              continue;
            }

            const localFilePath = path.join(workspaceRoot, localFile.path);
            let localCode: string;
            try {
              localCode = fs.readFileSync(localFilePath, "utf8");
            } catch (error) {
              console.error(
                `Failed to read local file ${localFilePath}:`,
                error,
              );
              failedUpdates++;
              continue;
            }

            await this.rateLimitedDelay();

            const remoteFileCode = await this.apiService?.readAICodeByPath(
              remoteFile.path,
            );

            if (!remoteFileCode) {
              console.warn(
                `Remote file not found for local file: ${localFile.path}`,
              );
              vscode.window.showErrorMessage(
                `Remote file not found for local file: ${localFile.path}`,
              );
              failedUpdates++;
              continue;
            }

            if (localCode !== remoteFileCode?.code) {
              console.log(`Updating file: ${localFile.path}`);
              await this.rateLimitedDelay();
              await this.apiService?.writeAICodeByPath(
                localFile.path,
                localCode,
              );
              successUpdates++;
            } else {
              // console.log(`File is up to date, skipping: ${localFile.path}`);
            }
          } else {
            console.warn(
              `Remote file not found for local file: ${localFile.path}`,
            );
            vscode.window.showErrorMessage(
              `Remote file not found for local file: ${localFile.path}`,
            );
            failedUpdates++;
          }
        }
        console.log(
          `File update summary: ${successUpdates} succeeded, ${failedUpdates} failed.`,
        );
        vscode.window.showInformationMessage(
          `File update completed: ${successUpdates} succeeded, ${failedUpdates} failed.`,
        );
      },
    );
  }

  private async createFilesByPath(files: string[]): Promise<void> {
    if (!this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    if (files.length === 0) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Creating ${files.length} remote file(s)`,
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          progress.report({
            message: `Creating: ${file}`,
            increment: (1 / files.length) * 100,
          });
          const folderPath = path.dirname(file);
          const fileName = path.basename(file);
          console.log("Creating file:", fileName, "in folder:", folderPath);
          await this.rateLimitedDelay();
          await this.apiService!.createAIV2({
            folderPath: folderPath === "." ? "" : folderPath, // if file is at root level, use empty string for folderPath
            name: fileName,
          });
        }
      },
    );
  }

  private async deleteFilesByPath(filePaths: string[]): Promise<void> {
    if (!this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    if (filePaths.length === 0) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Deleting ${filePaths.length} remote file(s)`,
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          progress.report({
            message: `Deleting: ${filePath}`,
            increment: (1 / filePaths.length) * 100,
          });
          console.log("Deleting file:", filePath);
          await this.rateLimitedDelay();
          await this.apiService!.deleteAIByPath(filePath);
        }
      },
    );
  }

  private async deleteFoldersByPath(folderPaths: string[]): Promise<void> {
    if (!this.apiService) {
      console.error("[LeekWars Service] API service not initialized");
      return;
    }

    if (folderPaths.length === 0) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Deleting ${folderPaths.length} remote folder(s)`,
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < folderPaths.length; i++) {
          const folderPath = folderPaths[i];
          progress.report({
            message: `Deleting: ${folderPath}`,
            increment: (1 / folderPaths.length) * 100,
          });
          await this.rateLimitedDelay();
          await this.apiService!.deleteFolderByPath(folderPath);
        }
      },
    );
  }

  /**
   * ['folderToDelete', 'folderToDelete/subFolderToDelete1', 'folderToDelete/subFolderToDelete2'] returns ['folderToDelete'] because deleting the parent folder will also delete the subfolder, so we don't need to delete it separately
   * @param folderPaths
   * @returns the input array without the subfolders that are already included by their parent folder in the list
   */
  private mergeFolderPathsToRootFolders(folderPaths: string[]): string[] {
    // Sort folder paths by depth (number of segments)
    const localFilesService = LocalFilesService.getInstance();
    const sortedPaths = localFilesService.sortPathsByFolderDepth(folderPaths);

    const rootFolders: string[] = [];

    for (const folderPath of sortedPaths) {
      // Check if the current folder is a subfolder of any already included root folder
      const isSubfolder = rootFolders.some((root) =>
        folderPath.startsWith(root + "/"),
      );
      if (!isSubfolder) {
        rootFolders.push(folderPath);
      }
    }

    return rootFolders;
  }

  /**
   * Compares local and remote, returns the list of the remote files that don't exist in local and should be deleted
   * @param localFilesMap
   * @param remoteFilesMap
   * @returns list of file paths that exist in remote but not in local
   */
  private findMissingFiles(
    localFilesMap: Map<string, FarmerTreeFile>,
    remoteFilesMap: Map<string, FarmerTreeFile>,
  ): string[] {
    const missingFiles: string[] = [];

    for (const remoteFile of remoteFilesMap.keys()) {
      if (!localFilesMap.has(remoteFile)) {
        missingFiles.push(remoteFile);
      }
    }

    return missingFiles;
  }

  private createFarmerTreeMap(
    paths: FarmerTreeFile[],
  ): Map<string, FarmerTreeFile> {
    const map = new Map<string, FarmerTreeFile>();

    for (const file of paths) {
      map.set(file.path, file);
    }

    return map;
  }

  private createLocalFileMap(paths: FarmerTreeFile[]): Map<string, string> {
    const localFoldersMap: Map<string, string> = new Map();

    for (const file of paths) {
      const folder = path.dirname(file.path);
      if (folder === ".") {
        continue; // file is at root level, skip
      }

      // Add folders that don't contain AI files, but other folders that contain AI files
      let currentFolderTmp = folder;
      let parentFolder = path.dirname(currentFolderTmp);

      // Add parent folders until we reach the root or a folder that already exists in localFoldersMap
      while (parentFolder !== "." && !localFoldersMap.has(parentFolder)) {
        localFoldersMap.set(parentFolder, parentFolder);
        currentFolderTmp = parentFolder;
        parentFolder = path.dirname(currentFolderTmp);
      }
      localFoldersMap.set(folder, folder);
    }

    return localFoldersMap;
  }

  private createPathMap(folderPaths: string[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const folderPath of folderPaths) {
      map.set(folderPath, folderPath);
    }

    return map;
  }

  /**
   * Compares local and remote, returns the list of of remote folders that don't exist in local and should be deleted
   * @param localFoldersMap
   * @param remoteFoldersMap
   */
  private findMissingFolders(
    localFoldersMap: Map<string, string>,
    remoteFoldersMap: Map<string, string>,
  ): string[] {
    const missingFolders: string[] = [];

    for (const remoteFolder of remoteFoldersMap.keys()) {
      if (!localFoldersMap.has(remoteFolder)) {
        missingFolders.push(remoteFolder);
      }
    }

    return missingFolders;
  }

  /**
   * Rate-limited delay to avoid API throttling
   */
  private async rateLimitedDelay(ms: number = 300): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
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

          await this.rateLimitedDelay();
          const farmerTreeResponse = await this.apiService!.getFarmerTree();

          console.log(
            "[LeekWars Service] farmerTreeResponse response:",
            farmerTreeResponse,
          );

          if (!farmerTreeResponse) {
            console.error(
              "[LeekWars Service] Error: Failed to fetch Farmer Tree",
            );
            console.error(
              "[LeekWars Service] Full response:",
              JSON.stringify(farmerTreeResponse, null, 2),
            );
            throw new Error(
              `Failed to fetch Farmer Tree. Check Developer Tools Console for details.`,
            );
          }

          // // Store the response for later use and persist it
          // await this.storeFarmerAIsResponse(farmerTreeResponse);

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

          if (!workspaceFolder) {
            throw new Error("No workspace folder open");
          }

          const workspaceRoot = workspaceFolder.uri.fsPath;
          const leekwarsDir = path.join(workspaceRoot, ".");

          console.log("Workspace root:", workspaceRoot);
          console.log("LeekWars directory:", leekwarsDir);
          // Create leekwars root directory if it doesn't exist
          if (!fs.existsSync(leekwarsDir)) {
            fs.mkdirSync(leekwarsDir, { recursive: true });
          }

          const totalRemoteFiles = farmerTreeResponse.files.length;

          // Create AI files
          progress.report({ message: "Pulling AI files..." });
          for (let i = 0; i < totalRemoteFiles; i++) {
            const file = farmerTreeResponse.files[i];

            progress.report({
              message: `Pulling ${file.path} (${i + 1}/${totalRemoteFiles})...`,
              increment: 100 / totalRemoteFiles,
            });
            await this.pullLeekwarsFile(file);
          }

          vscode.window.showInformationMessage(
            `Successfully pulled ${totalRemoteFiles} AI(s) from LeekWars`,
          );
        },
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to pull AIs: ${error.message}`);
    }
  }

  private async pullLeekwarsFile(file: FarmerTreeFile) {
    if (!this.initializeApi()) {
      return;
    }

    await this.rateLimitedDelay();
    const codeResponse = await this.apiService!.readAICodeByPath(file.path);

    if (codeResponse.error) {
      console.error(
        `Failed to get remote AI code at path ${file.path}:`,
        codeResponse.error,
      );
      return;
    }

    // get file name from path
    const fileName = path.basename(file.path);
    // get file folder
    const fileFolder = path.dirname(file.path);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    // check if workspace is open
    if (!workspaceFolder) {
      throw new Error("No workspace folder open");
    }

    // check if file folder is root or subfolder
    const isRoot = fileFolder === "." || fileFolder === path.sep;

    if (isRoot) {
      const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
      fs.writeFileSync(filePath, codeResponse.code, "utf8");
      console.log(`[LeekWars Service] Created AI file: ${filePath}`);
    } else {
      const folderPath = path.join(workspaceFolder.uri.fsPath, fileFolder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`[LeekWars Service] Created folder: ${folderPath}`);
      }
      const filePath = path.join(folderPath, fileName);
      fs.writeFileSync(filePath, codeResponse.code, "utf8");
      console.log(`[LeekWars Service] Created AI file: ${filePath}`);
    }
  }
}
