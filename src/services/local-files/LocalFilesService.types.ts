export interface FileNode {
  name: string;
  path: string;
  type: "file";
}

export interface FolderNode {
  name: string;
  path: string;
  type: "folder";
  children: (FileNode | FolderNode)[];
}

export type TreeNode = FileNode | FolderNode;

export interface LocalFilesState {
  root: FolderNode[];
}
