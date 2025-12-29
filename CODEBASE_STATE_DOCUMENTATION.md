# CodeBase State Management System

## Overview

The CodeBase State Management system provides a comprehensive way to track and synchronize LeekScript files and folders across three different states:

1. **Local Filesystem** - Files and folders in the user's workspace
2. **LeekWars API** - Files (AIs) and folders on LeekWars servers
3. **CodeAnalyzer Server** - Files and folders on the local analysis server

## Architecture

### Core Components

#### 1. **CodeBaseState** (`CodeBaseState.ts`)

The main state container that holds all information about files and folders.

**Key Interfaces:**

- `CodeBaseState` - Main state container with files and folders Maps
- `CodeBaseFile` - Complete state for a single file across all three sources
- `CodeBaseFolder` - Complete state for a folder across all three sources
- `LocalFileState` / `LocalFolderState` - Local filesystem information
- `LeekWarsFileState` / `LeekWarsFolderState` - LeekWars API information
- `CodeAnalyzerFileState` / `CodeAnalyzerFolderState` - Analyzer server information

**Features:**

- Track file content, size, modification times, hashes
- Map files to their LeekWars AI IDs and CodeAnalyzer IDs
- Maintain folder hierarchy across all three states
- Sync status tracking with `SyncStatus` enum
- Helper functions for state queries and comparisons

#### 2. **CodeBaseStateManager** (`CodeBaseStateManager.ts`)

Service for managing and persisting the codebase state.

**Key Features:**

- Persistent storage via VS Code's `globalState` API
- Automatic serialization/deserialization
- File and folder state updates
- Bulk sync operations
- Query operations for finding files/folders
- Statistics generation

**Main Methods:**

##### File Operations

```typescript
// Get file by path
getFile(absolutePath: string): CodeBaseFile | undefined

// Get file by LeekWars AI ID
getFileByLeekWarsId(aiId: number): CodeBaseFile | null

// Get file by CodeAnalyzer AI ID
getFileByAnalyzerId(aiId: number): CodeBaseFile | null

// Update file states
updateFileLocalState(absolutePath: string, workspaceRoot: string): Promise<void>
updateFileLeekWarsState(absolutePath: string, state: LeekWarsFileState): Promise<void>
updateFileAnalyzerState(absolutePath: string, state: CodeAnalyzerFileState): Promise<void>

// Get sync status
getFileSyncStatus(absolutePath: string): SyncStatus | null
```

##### Folder Operations

```typescript
// Get folder by ID
getFolder(folderId: string): CodeBaseFolder | undefined

// Get folder by LeekWars folder ID
getFolderByLeekWarsId(folderId: number): CodeBaseFolder | null

// Get folder by CodeAnalyzer folder ID
getFolderByAnalyzerId(folderId: number): CodeBaseFolder | null

// Update folder states
updateFolderLocalState(folderId: string, absolutePath: string, ...): Promise<void>
updateFolderLeekWarsState(folderId: string, state: LeekWarsFolderState): Promise<void>
updateFolderAnalyzerState(folderId: string, state: CodeAnalyzerFolderState): Promise<void>

// Get folder contents
getFilesInFolder(folderId: string): CodeBaseFile[]
getSubfolders(folderId: string | null): CodeBaseFolder[]
```

##### Bulk Operations

```typescript
// Sync from LeekWars API
syncFromLeekWars(ais, folders, workspaceRoot, leekwarsDir): Promise<void>

// Scan local workspace
scanLocalWorkspace(workspaceRoot: string, leekwarsDir: string): Promise<void>

// Get statistics
getStatistics(): { totalFiles, filesInSync, ... }
```

## Data Flow

### 1. Pulling from LeekWars

```
User triggers "Pull All AIs"
  ↓
LeekWarsService.pullAllAIs()
  ↓
Fetches data from LeekWars API
  ↓
Creates local files and folders
  ↓
Calls codebaseStateManager.syncFromLeekWars()
  ↓
Updates CodeBaseState with:
  - Local file information (path, size, hash)
  - LeekWars information (AI ID, folder ID, validity)
  ↓
Persists state to globalState
```

### 2. Local File Changes

```
User edits a .leek file
  ↓
DocumentEventHandler detects change
  ↓
Updates CodeBaseStateManager:
  - New content hash
  - New modification time
  - New file size
  ↓
Sync status changes to "LocalAhead"
  ↓
Can trigger sync operations later
```

### 3. Code Analysis

```
File is analyzed by CodeAnalyzer
  ↓
DiagnosticService gets results
  ↓
Updates CodeBaseStateManager:
  - Analyzer AI ID
  - Error/warning counts
  - Analysis timestamp
  ↓
Can compare with LeekWars state
```

## Sync Status

The system tracks six different sync states:

| Status        | Description                   | Example                        |
| ------------- | ----------------------------- | ------------------------------ |
| `InSync`      | All states match              | File unchanged since last pull |
| `LocalAhead`  | Local changes not pushed      | User edited file locally       |
| `RemoteAhead` | Remote changes not pulled     | Someone updated on LeekWars    |
| `Conflict`    | Both local and remote changed | Needs manual resolution        |
| `NotSynced`   | Never been synced             | New local file                 |
| `LocalOnly`   | Only exists locally           | Not yet uploaded               |
| `RemoteOnly`  | Only exists remotely          | Not yet downloaded             |

## Usage Examples

### Example 1: Check if a file is in sync

```typescript
const codebaseManager = new CodeBaseStateManager(context);
const file = codebaseManager.getFile("/path/to/file.leek");

if (file) {
  const status = CodeBaseStateHelpers.getFileSyncStatus(file);

  if (status === SyncStatus.LocalAhead) {
    console.log("File has local changes that need to be pushed");
  }
}
```

### Example 2: Find file by LeekWars AI ID

```typescript
const file = codebaseManager.getFileByLeekWarsId(12345);

if (file) {
  console.log(`File path: ${file.local.absolutePath}`);
  console.log(`LeekWars valid: ${file.leekwars?.valid}`);
  console.log(`Analyzer errors: ${file.analyzer?.lastAnalysis?.errors}`);
}
```

### Example 3: Get all files that need syncing

```typescript
const filesNeedingSync = codebaseManager.getFilesBySyncStatus(
  SyncStatus.LocalAhead
);

console.log(`${filesNeedingSync.length} files need to be pushed to LeekWars`);
```

### Example 4: Get codebase statistics

```typescript
const stats = codebaseManager.getStatistics();

console.log(`Total files: ${stats.totalFiles}`);
console.log(`Files in sync: ${stats.filesInSync}`);
console.log(`Local only: ${stats.filesLocalOnly}`);
console.log(`Remote only: ${stats.filesRemoteOnly}`);
```

## Integration Points

### LeekWarsService

- Calls `syncFromLeekWars()` after pulling AIs
- Can use state to determine what needs updating
- Future: Use state to push only changed files

### CodeAnalyzerService

- Can update analyzer state after analysis
- Future: Can compare analyzer state with LeekWars state
- Future: Can detect files that need re-analysis

### DiagnosticService

- Can update analyzer state with error counts
- Can query file state for context
- Future: Can show sync status in diagnostics

## Future Enhancements

1. **Push to LeekWars** - Upload only files with `LocalAhead` status
2. **Conflict Resolution** - UI for resolving conflicting changes
3. **Selective Sync** - Choose which files/folders to sync
4. **Auto-sync** - Automatically sync on save/interval
5. **Sync History** - Track sync events over time
6. **Diff Viewer** - Compare states visually
7. **Merge Tool** - Merge conflicting changes
8. **Status Bar Integration** - Show sync status in status bar
9. **File Decorations** - Show sync icons in file explorer

## Storage

State is persisted using VS Code's `globalState` API:

- **Key**: `codebase.state`
- **Format**: Serialized JSON with Maps converted to arrays
- **Persistence**: Survives extension reloads and VS Code restarts
- **Size**: Automatically managed by VS Code

## Performance Considerations

- Maps used for O(1) lookups
- State only saved when changed
- Lazy loading of file content
- Hashing used for change detection
- Folder hierarchy maintained for efficient queries

## Error Handling

- Graceful degradation if state can't be loaded
- Fallback to empty state on corruption
- Logging for debugging
- Error messages for user actions
