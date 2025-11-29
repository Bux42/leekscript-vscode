import * as vscode from "vscode";
import * as path from "path";
import {
  FileNode,
  FolderNode,
  LocalFilesState,
  TreeNode,
} from "./LocalFilesService.types";

export class LocalFilesService {
  private static instance: LocalFilesService;

  private constructor() {}

  public static getInstance(): LocalFilesService {
    if (!LocalFilesService.instance) {
      LocalFilesService.instance = new LocalFilesService();
    }
    return LocalFilesService.instance;
  }

  /**
   * Recursively gets all .leek files in the current workspace and builds a tree structure
   */
  public async getLocalFilesState(): Promise<LocalFilesState> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return { root: [] };
    }

    const root: FolderNode[] = [];

    for (const workspaceFolder of workspaceFolders) {
      const folderNode = await this.buildTreeForFolder(workspaceFolder.uri);
      if (folderNode) {
        root.push(folderNode);
      }
    }

    return { root };
  }

  /**
   * Builds a tree structure for a given folder URI
   */
  private async buildTreeForFolder(
    folderUri: vscode.Uri
  ): Promise<FolderNode | null> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      const children: TreeNode[] = [];

      for (const [name, type] of entries) {
        const entryUri = vscode.Uri.joinPath(folderUri, name);

        if (type === vscode.FileType.Directory) {
          // Recursively process subdirectories
          const subFolder = await this.buildTreeForFolder(entryUri);
          if (subFolder && subFolder.children.length > 0) {
            children.push(subFolder);
          }
        } else if (type === vscode.FileType.File && name.endsWith(".leek")) {
          // Add .leek files
          const fileNode: FileNode = {
            name,
            path: entryUri.fsPath,
            type: "file",
          };
          children.push(fileNode);
        }
      }

      // Only return the folder if it has children
      if (children.length === 0) {
        return null;
      }

      const folderNode: FolderNode = {
        name: path.basename(folderUri.fsPath),
        path: folderUri.fsPath,
        type: "folder",
        children,
      };

      return folderNode;
    } catch (error) {
      console.error(`Error reading directory ${folderUri.fsPath}:`, error);
      return null;
    }
  }
}
