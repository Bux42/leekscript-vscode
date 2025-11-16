/**
 * Represents state information from the LeekWars API
 */
export interface LeekWarsFileState {
  /** AI ID from LeekWars */
  id: number;
  /** AI name (filename) */
  name: string;
  /** Folder ID on LeekWars */
  folderId: number;
  /** LeekScript version (4 for LeekScript 2) */
  version: number;
  /** Whether the AI is valid on LeekWars */
  valid: boolean;
  /** AI level (optional) */
  level?: number;
  /** Last known code from LeekWars */
  code?: string;
  /** Last sync timestamp */
  lastSyncTime?: number;
}

/**
 * Represents state information from the LeekWars API for folders
 */
export interface LeekWarsFolderState {
  /** Folder ID from LeekWars */
  id: number;
  /** Folder name */
  name: string;
  /** Parent folder ID (0 for root) */
  parentFolderId: number;
}

/**
 * Represents state information from the CodeAnalyzer server
 */
export interface CodeAnalyzerFileState {
  /** AI ID assigned by CodeAnalyzer server */
  aiId: number;
  /** Analysis result (error count, warning count, etc.) */
  lastAnalysis?: {
    errors: number;
    warnings: number;
    timestamp: number;
  };
  /** Whether the file is currently on the server */
  existsOnServer: boolean;
}

/**
 * Represents state information from the CodeAnalyzer server for folders
 */
export interface CodeAnalyzerFolderState {
  /** Folder ID on CodeAnalyzer server */
  folderId: number;
  /** Whether the folder exists on the server */
  existsOnServer: boolean;
}

/**
 * Represents local filesystem state
 */
export interface LocalFileState {
  /** Absolute file path */
  absolutePath: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: number;
  /** File content hash (for change detection) */
  contentHash?: string;
}

/**
 * Represents local filesystem state for folders
 */
export interface LocalFolderState {
  /** Absolute folder path */
  absolutePath: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * Complete state information for a LeekScript file
 */
export interface CodeBaseFile {
  /** Local filesystem state (null if file only exists remotely) */
  local: LocalFileState | null;
  /** LeekWars API state (null if not synced with LeekWars) */
  leekwars: LeekWarsFileState | null;
  /** CodeAnalyzer server state (null if not synced with server) */
  analyzer: CodeAnalyzerFileState | null;
  /** Parent folder ID (for organization) */
  parentFolderId?: string;
}

/**
 * Complete state information for a folder
 */
export interface CodeBaseFolder {
  /** Unique identifier for this folder */
  id: string;
  /** Local filesystem state (null if folder only exists remotely) */
  local: LocalFolderState | null;
  /** LeekWars API state (null if not synced with LeekWars) */
  leekwars: LeekWarsFolderState | null;
  /** CodeAnalyzer server state (null if not synced with server) */
  analyzer: CodeAnalyzerFolderState | null;
  /** Parent folder ID (null for root folders) */
  parentFolderId: string | null;
}

/**
 * Sync status between different states
 */
export enum SyncStatus {
  /** All states are in sync */
  InSync = "in-sync",
  /** Local is ahead of remote(s) */
  LocalAhead = "local-ahead",
  /** Remote(s) ahead of local */
  RemoteAhead = "remote-ahead",
  /** Conflicting changes */
  Conflict = "conflict",
  /** Not yet synced */
  NotSynced = "not-synced",
  /** Only exists locally */
  LocalOnly = "local-only",
  /** Only exists on remote(s) */
  RemoteOnly = "remote-only",
}

/**
 * Complete codebase state
 */
export interface CodeBaseState {
  /** All tracked files, keyed by absolute path */
  files: Map<string, CodeBaseFile>;
  /** All tracked folders, keyed by unique folder ID */
  folders: Map<string, CodeBaseFolder>;
  /** Owner ID (farmer ID from LeekWars) */
  ownerId: number | null;
  /** Last full sync timestamp */
  lastFullSync: number | null;
  /** Version of the state structure (for future migrations) */
  version: number;
}

/**
 * Serializable version of CodeBaseState for persistence
 */
export interface SerializedCodeBaseState {
  files: Array<[string, CodeBaseFile]>;
  folders: Array<[string, CodeBaseFolder]>;
  ownerId: number | null;
  lastFullSync: number | null;
  version: number;
}

/**
 * Helper functions for working with CodeBaseState
 */
export class CodeBaseStateHelpers {
  /**
   * Serialize CodeBaseState for storage
   */
  static serialize(state: CodeBaseState): SerializedCodeBaseState {
    return {
      files: Array.from(state.files.entries()),
      folders: Array.from(state.folders.entries()),
      ownerId: state.ownerId,
      lastFullSync: state.lastFullSync,
      version: state.version,
    };
  }

  /**
   * Deserialize CodeBaseState from storage
   */
  static deserialize(serialized: SerializedCodeBaseState): CodeBaseState {
    return {
      files: new Map(serialized.files),
      folders: new Map(serialized.folders),
      ownerId: serialized.ownerId,
      lastFullSync: serialized.lastFullSync,
      version: serialized.version,
    };
  }

  /**
   * Create an empty CodeBaseState
   */
  static createEmpty(): CodeBaseState {
    return {
      files: new Map(),
      folders: new Map(),
      ownerId: null,
      lastFullSync: null,
      version: 1,
    };
  }

  /**
   * Get sync status for a file
   */
  static getFileSyncStatus(file: CodeBaseFile): SyncStatus {
    const hasLocal = !!file.local;
    const hasLeekWars = !!file.leekwars;
    const hasAnalyzer = !!file.analyzer;

    // Only exists locally
    if (hasLocal && !hasLeekWars && !hasAnalyzer) {
      return SyncStatus.LocalOnly;
    }

    // Only exists on remote(s)
    if (!hasLocal && (hasLeekWars || hasAnalyzer)) {
      return SyncStatus.RemoteOnly;
    }

    // Not synced yet
    if (!hasLeekWars && !hasAnalyzer) {
      return SyncStatus.NotSynced;
    }

    // Check if in sync (comparing timestamps and content)
    if (hasLocal && hasLeekWars && file.leekwars?.lastSyncTime && file.local) {
      const localModified = file.local.lastModified;
      const remoteSync = file.leekwars.lastSyncTime;

      if (localModified > remoteSync) {
        return SyncStatus.LocalAhead;
      } else if (localModified < remoteSync) {
        return SyncStatus.RemoteAhead;
      }
    }

    return SyncStatus.InSync;
  }

  /**
   * Get sync status for a folder
   */
  static getFolderSyncStatus(folder: CodeBaseFolder): SyncStatus {
    const hasLocal = !!folder.local;
    const hasLeekWars = !!folder.leekwars;
    const hasAnalyzer = !!folder.analyzer;

    // Only exists locally
    if (hasLocal && !hasLeekWars && !hasAnalyzer) {
      return SyncStatus.LocalOnly;
    }

    // Only exists on remote(s)
    if (!hasLocal && (hasLeekWars || hasAnalyzer)) {
      return SyncStatus.RemoteOnly;
    }

    // Not synced yet
    if (!hasLeekWars && !hasAnalyzer) {
      return SyncStatus.NotSynced;
    }

    return SyncStatus.InSync;
  }

  /**
   * Find file by LeekWars AI ID
   */
  static findFileByLeekWarsId(
    state: CodeBaseState,
    aiId: number
  ): CodeBaseFile | null {
    for (const file of state.files.values()) {
      if (file.leekwars?.id === aiId) {
        return file;
      }
    }
    return null;
  }

  /**
   * Find file by CodeAnalyzer AI ID
   */
  static findFileByAnalyzerId(
    state: CodeBaseState,
    aiId: number
  ): CodeBaseFile | null {
    for (const file of state.files.values()) {
      if (file.analyzer?.aiId === aiId) {
        return file;
      }
    }
    return null;
  }

  /**
   * Find folder by LeekWars folder ID
   */
  static findFolderByLeekWarsId(
    state: CodeBaseState,
    folderId: number
  ): CodeBaseFolder | null {
    for (const folder of state.folders.values()) {
      if (folder.leekwars?.id === folderId) {
        return folder;
      }
    }
    return null;
  }

  /**
   * Find folder by CodeAnalyzer folder ID
   */
  static findFolderByAnalyzerId(
    state: CodeBaseState,
    folderId: number
  ): CodeBaseFolder | null {
    for (const folder of state.folders.values()) {
      if (folder.analyzer?.folderId === folderId) {
        return folder;
      }
    }
    return null;
  }

  /**
   * Get all files in a folder
   */
  static getFilesInFolder(
    state: CodeBaseState,
    folderId: string
  ): CodeBaseFile[] {
    const files: CodeBaseFile[] = [];
    for (const file of state.files.values()) {
      if (file.parentFolderId === folderId) {
        files.push(file);
      }
    }
    return files;
  }

  /**
   * Get all subfolders of a folder
   */
  static getSubfolders(
    state: CodeBaseState,
    folderId: string | null
  ): CodeBaseFolder[] {
    const subfolders: CodeBaseFolder[] = [];
    for (const folder of state.folders.values()) {
      if (folder.parentFolderId === folderId) {
        subfolders.push(folder);
      }
    }
    return subfolders;
  }
}
