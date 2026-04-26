import * as vscode from "vscode";
import * as path from "path";
import { FarmerTreeFile, GetFarmerTreeResponse } from "../leekwars/LeekWarsApi";

export class LocalFilesService {
  private static instance: LocalFilesService;
  private localFilesState: FarmerTreeFile[] = [];

  private constructor() {}

  public static getInstance(): LocalFilesService {
    if (!LocalFilesService.instance) {
      LocalFilesService.instance = new LocalFilesService();
    }
    return LocalFilesService.instance;
  }

  public async getLocalFilesState(): Promise<FarmerTreeFile[] | null> {
    if (this.localFilesState.length > 0) {
      return this.localFilesState;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;

    // console.log("[getLocalFilesState] Workspace folders:", workspaceFolders);

    if (!workspaceFolders || workspaceFolders.length !== 1) {
      console.error(
        "[getLocalFilesState] Expected exactly one workspace folder, found:",
        workspaceFolders,
      );
      return null;
    }

    const allLeekFiles = await this.getAllLeekFilesFromUri(
      workspaceFolders[0].uri,
    );

    // console.log(".leek files found in workspace: ", allLeekFiles.length);

    const allLeekFilesRelative = this.convertLeekFilesAsolutePathsToRelative(
      allLeekFiles,
      workspaceFolders[0].uri.fsPath,
    );

    // Normalize to forward slashes to have same format as LeekWars API paths
    const allLeekFilesNormalized = allLeekFilesRelative.map((file) =>
      file.replace(/\\/g, "/"),
    );

    // sort files to get top folder first
    const allLeekFilesSorted = this.sortPathsByFolderDepth(
      allLeekFilesNormalized,
    );

    // convert to FarmerTreeFile[]
    const allLeekFilesAsFarmerTreeFiles: FarmerTreeFile[] = await Promise.all(
      allLeekFilesSorted.map(async (file) => ({
        path: file,
        mtime: 0,
        valid: true,
        version: 4,
        strict: false,
        entrypoint: false,
        total_lines: await this.getTotalLinesFromRelativePath(file),
        total_chars: await this.getTotalCharsFromRelativePath(file),
        scenario: null,
      })),
    );

    // console.log(
    //   "allLeekFilesSorted .leek files: ",
    //   allLeekFilesAsFarmerTreeFiles,
    // );
    return allLeekFilesAsFarmerTreeFiles;
  }

  /**
   * Sorts an array of file paths so that files in root folders come first, and files in nested folders come after
   * @param paths
   * @returns The input paths array, sorted so that root files are first and nested files are last
   */
  public sortPathsByFolderDepth(paths: string[]): string[] {
    return paths.sort((a, b) => {
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      return depthA - depthB;
    });
  }

  public async getTotalLinesFromRelativePath(
    relativePath: string,
  ): Promise<number> {
    const fullPath = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      relativePath,
    );

    try {
      const fileContent = vscode.workspace.fs.readFile(
        vscode.Uri.file(fullPath),
      );

      const content = await fileContent;
      const text = new TextDecoder("utf-8").decode(content);
      return text.split("\n").length;
    } catch (error) {
      console.error(`Error reading file ${fullPath}:`, error);
      return 0;
    }
  }

  public async getTotalCharsFromRelativePath(
    relativePath: string,
  ): Promise<number> {
    const fullPath = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      relativePath,
    );

    try {
      const fileContent = vscode.workspace.fs.readFile(
        vscode.Uri.file(fullPath),
      );

      const content = await fileContent;
      return content.length;
    } catch (error) {
      console.error(`Error reading file ${fullPath}:`, error);
      return 0;
    }
  }

  public convertLeekFilesAsolutePathsToRelative(
    files: string[],
    workspaceRoot: string,
  ): string[] {
    return files.map((file) => path.relative(workspaceRoot, file));
  }

  public async getAllLeekFilesFromUri(uri: vscode.Uri): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      for (const [name, type] of entries) {
        const entryUri = vscode.Uri.joinPath(uri, name);
        if (type === vscode.FileType.Directory) {
          const subFiles = await this.getAllLeekFilesFromUri(entryUri);
          files.push(...subFiles);
        } else if (type === vscode.FileType.File && name.endsWith(".leek")) {
          files.push(entryUri.fsPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${uri.fsPath}:`, error);
    }

    return files;
  }

  setLocalFileState(files: FarmerTreeFile[]) {
    this.localFilesState = files;
  }

  addNewFileToState(filePath: string) {
    console.log("Adding new file to local state:", filePath);

    if (this.localFilesState.some((file) => file.path === filePath)) {
      console.warn(
        `File ${filePath} already exists in local state when trying to add. Skipping.`,
      );
      return;
    }

    const file: FarmerTreeFile = {
      path: filePath,
      entrypoint: false,
      mtime: 0,
      valid: true,
      version: 4,
      strict: false,
      total_lines: 0,
      total_chars: 0,
      scenario: null,
    };
    this.localFilesState.push(file);
  }

  updateFileInState(filePath: string) {
    console.log("Updating file in local state:", filePath);
    const fileIndex = this.localFilesState.findIndex(
      (file) => file.path === filePath,
    );

    if (fileIndex !== -1) {
      this.localFilesState[fileIndex].mtime = Date.now();
    } else {
      console.warn(
        `File ${filePath} not found in local state when trying to update. Adding it as new file.`,
      );
      this.addNewFileToState(filePath);
    }
  }

  removeFileFromState(filePath: string) {
    console.log("Removing file from local state:", filePath);
    this.localFilesState = this.localFilesState.filter(
      (file) => file.path !== filePath,
    );
  }

  removeAllFilesInFolderFromState(folderPath: string) {
    console.log("Removing all files in folder from local state:", folderPath);
    this.localFilesState = this.localFilesState.filter((file) => {
      const removed = file.path.startsWith(folderPath + "/");
      if (removed) {
        console.log("Removing file due to folder removal:", file.path);
      }
      return !removed;
    });

    // console.log(
    //   "Remaining files in local state after folder removal:",
    //   this.localFilesState,
    // );
  }
}
