/**
 * Folder class for file system hierarchy and include resolution
 * Ported from Java Folder.java
 */

import { Folder as IFolder, AIFile } from "./types";

/**
 * Folder implementation with path resolution for includes
 */
export class Folder implements IFolder {
  id: number;
  owner: number;
  name: string;
  parent: Folder | null;
  root: Folder;
  files: Map<string, AIFile>;
  folders: Map<string, Folder>;
  timestamp: number;

  constructor(
    id: number,
    owner: number,
    name: string,
    parent: Folder | null,
    root: Folder | null
  ) {
    this.id = id;
    this.owner = owner;
    this.name = name;
    this.parent = parent;
    this.root = root || this; // Root points to itself
    this.files = new Map();
    this.folders = new Map();
    this.timestamp = Date.now();
  }

  /**
   * Resolve a relative or absolute path to an AIFile
   *
   * Path resolution rules:
   * - /path → resolve from root
   * - ./path → resolve from current folder (prefix ignored)
   * - ../path → resolve from parent folder
   * - folder/file → resolve subfolder then file
   * - Escaped slashes (\/) in names are handled (legacy support)
   */
  resolve(path: string): AIFile | null {
    // Absolute path: start from root
    if (path.startsWith("/")) {
      return this.root.resolve(path.substring(1));
    }

    // Current directory prefix: ignore it
    if (path.startsWith("./")) {
      return this.resolve(path.substring(2));
    }

    // Parent directory: go up one level
    if (path.startsWith("../")) {
      if (!this.parent) {
        return null; // Can't go above root
      }
      return this.parent.resolve(path.substring(3));
    }

    // Check for subfolder separator
    // Handle escaped slashes (\/) in old AI names
    for (let i = 1; i < path.length; i++) {
      if (path.charAt(i) === "/" && path.charAt(i - 1) !== "\\") {
        // This is a real separator, not an escaped one
        const folderName = path.substring(0, i);
        const subFolder = this.getFolder(folderName);
        if (!subFolder) {
          return null; // Subfolder not found
        }
        return subFolder.resolve(path.substring(i + 1));
      }
    }

    // No separator found: look for file in this folder
    // Remove escaped slashes from the name
    const fileName = path.replace(/\\\//g, "/");
    return this.getFile(fileName);
  }

  /**
   * Get a subfolder by name
   */
  getFolder(name: string): Folder | null {
    return this.folders.get(name) || null;
  }

  /**
   * Get a file by name
   */
  getFile(name: string): AIFile | null {
    return this.files.get(name) || null;
  }

  /**
   * Add a subfolder
   */
  addFolder(name: string, folder: Folder): void {
    this.folders.set(name, folder);
  }

  /**
   * Add a file
   */
  addFile(name: string, file: AIFile): void {
    this.files.set(name, file);
  }

  /**
   * Set parent folder
   */
  setParent(parent: Folder): void {
    this.parent = parent;
  }

  /**
   * Set root folder
   */
  setRoot(root: Folder): void {
    this.root = root;
  }

  /**
   * Get full path of this folder
   */
  getPath(): string {
    if (this.parent === null || this.parent === this) {
      return "/";
    }
    const parentPath = this.parent.getPath();
    return parentPath === "/" ? `/${this.name}` : `${parentPath}/${this.name}`;
  }
}
