import * as vscode from "vscode";
import * as path from "path";
import {
  FileNode,
  FolderNode,
  LocalFilesState,
  TreeNode,
} from "./LocalFilesService.types";
import { GetFarmerAIsResponse } from "../leekwars/LeekWarsApi";

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
   * Converts a GetFarmerAIsResponse to LocalFilesState format
   */
  public farmersAIToLocalFileState(
    response: GetFarmerAIsResponse
  ): LocalFilesState {
    if (!response.ais || !response.folders) {
      return { root: [] };
    }

    // Create a map of folder ID to folder info
    const folderMap = new Map<
      number,
      { id: number; name: string; folder: number }
    >();
    response.folders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });

    // Create a map to hold folder nodes by their ID
    const folderNodesMap = new Map<number, FolderNode>();

    // Initialize root node (folder ID 0)
    const rootChildren: TreeNode[] = [];

    // Create all folder nodes first
    response.folders.forEach((folder) => {
      const folderNode: FolderNode = {
        name: folder.name,
        path: folder.folder == 0 ? folder.name : `/${folder.name}`,
        type: "folder",
        children: [],
        leekWarsFolderInfo: folder,
      };
      folderNodesMap.set(folder.id, folderNode);
    });

    // Add AI files to their respective folders
    response.ais.forEach((ai) => {
      const fileNode: FileNode = {
        name: ai.name,
        path: ai.name,
        type: "file",
        leekWarsAIInfo: ai,
      };

      if (ai.folder === 0) {
        // AI is in root
        rootChildren.push(fileNode);
      } else {
        // AI is in a folder
        const parentFolder = folderNodesMap.get(ai.folder);
        if (parentFolder) {
          parentFolder.children.push(fileNode);
          // Update path to include parent folder
          fileNode.path = `${parentFolder.path}/${ai.name}`;
        }
      }
    });

    // Build the folder hierarchy
    response.folders.forEach((folder) => {
      const folderNode = folderNodesMap.get(folder.id);
      if (!folderNode) return;

      if (folder.folder === 0) {
        // This folder is at root level - include even if empty
        rootChildren.push(folderNode);
      } else {
        // This folder is nested in another folder
        const parentFolder = folderNodesMap.get(folder.folder);
        if (parentFolder) {
          // Include folder even if empty
          parentFolder.children.push(folderNode);
          // Update path to include parent folder
          folderNode.path = `${parentFolder.path}/${folderNode.name}`;
          // Update all children paths recursively
          this.updateChildrenPaths(folderNode);
        }
      }
    });

    // If we have a single workspace-like root, wrap it
    if (rootChildren.length > 0) {
      const workspaceRoot: FolderNode = {
        name: "LeekWars AIs",
        path: "/",
        type: "folder",
        children: rootChildren,
        leekWarsFolderInfo: { id: 0, name: "LeekWars AIs", folder: 0 },
      };
      return { root: [workspaceRoot] };
    }

    return { root: [] };
  }

  /**
   * Helper method to recursively update paths for all children nodes
   */
  private updateChildrenPaths(folderNode: FolderNode): void {
    folderNode.children.forEach((child) => {
      child.path = `${folderNode.path}/${child.name}`;
      if (child.type === "folder") {
        this.updateChildrenPaths(child);
      }
    });
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

      // Get relative path from workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;

      if (!workspaceFolders || workspaceFolders.length === 0) {
        console.error("[buildTreeForFolder] No workspace folder found");
        return null;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath + "\\";

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
            // Get relative path from workspace
            path: entryUri.fsPath.replace(workspaceRoot, ""),
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
        // Get relative path from workspace
        path: folderUri.fsPath.replace(workspaceRoot, ""),
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
