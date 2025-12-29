import { LeekWarsAIInfo } from "../leekwars";

export interface FileNode {
  name: string;
  path: string;
  type: "file";
  leekWarsAIInfo?: LeekWarsAIInfo;
  code?: string;
}

export interface FolderNode {
  name: string;
  path: string;
  type: "folder";
  children: (FileNode | FolderNode)[];
  leekWarsFolderInfo?: { id: number; name: string; folder: number };
}

export type TreeNode = FileNode | FolderNode;

export interface LocalFilesState {
  root: FolderNode[];
}
