# Code Analyzer Service

## Overview

The `CodeAnalyzerService` is a TypeScript service that provides a complete wrapper for the LeekScript Code Analysis Server API. It enables VSCode extensions to interact with the analysis server for real-time code validation, error detection, and file management.

## Features

- ✅ **Full API Coverage** - All endpoints from the API documentation are implemented
- ✅ **Type Safety** - Complete TypeScript type definitions for all data structures
- ✅ **Error Handling** - Comprehensive error handling with user-friendly messages
- ✅ **Server Status** - Built-in server availability checking
- ✅ **Logging** - Console logging for debugging and monitoring
- ✅ **VSCode Integration** - Native integration with VSCode notification system

## Installation

The service uses Node.js built-in `http` module for HTTP communication. No additional dependencies are required.

## Quick Start

```typescript
import { CodeAnalyzerService } from './services/analyzer';

// Initialize in your extension's activate function
const analyzerService = new CodeAnalyzerService(context);

// Check if server is running
const isRunning = await analyzerService.checkServerStatus();

// Create an AI file and analyze code
const ai = await analyzerService.createAI(0, "bot.leek");
const result = await analyzerService.saveAI(ai.id, "var x = 5;");
```

## API Methods

### Server Status
- `checkServerStatus(): Promise<boolean>` - Check if server is running
- `getServerStatus(): boolean` - Get cached server status
- `notifyIfServerNotRunning(): Promise<boolean>` - Show warning if server not running

### Owner Management
- `setOwnerId(ownerId: number): Promise<void>` - Set the farmer/owner ID
- `getOwnerId(): Promise<number | null>` - Get current owner ID

### AI File Operations
- `createAI(folderId, name, version?): Promise<AIFile | null>` - Create new AI file
- `saveAI(aiId, code): Promise<SaveAIResponse | null>` - Save and analyze code
- `renameAI(aiId, newName): Promise<boolean>` - Rename AI file
- `deleteAI(aiId): Promise<boolean>` - Delete AI file
- `changeAIFolder(aiId, folderId): Promise<boolean>` - Move AI to folder
- `getAI(aiId): Promise<AIFile | null>` - Get AI file info
- `listAIs(folderId?): Promise<AIFile[]>` - List all or filtered AI files

### Folder Operations
- `createFolder(parentId, name): Promise<number | null>` - Create folder
- `createFolderWithId(id, parentId, name): Promise<number | null>` - Create with specific ID
- `renameFolder(folderId, newName): Promise<boolean>` - Rename folder
- `deleteFolder(folderId): Promise<boolean>` - Delete folder (cascade)
- `changeFolderParent(folderId, destId): Promise<boolean>` - Move folder
- `getFolder(folderId): Promise<Folder | null>` - Get folder info
- `listFolders(): Promise<Folder[]>` - List all folders

## Type Definitions

```typescript
interface AIFile {
  id: number;
  name: string;
  folder_id: number;
  code?: string;
  version: number;
  level?: number;
}

interface Folder {
  id: number;
  name: string;
  parent_id: number;
}

type AnalysisError = [
  number,   // level: 0=error, 1=warning
  number,   // ai_id
  number,   // start_line
  number,   // start_column
  number,   // end_line
  number,   // end_column
  number,   // error_code
  string[]  // parameters
];

interface SaveAIResponse {
  result: {
    [ai_id: string]: AnalysisError[];
  };
  modified: number;
}
```

## Usage Examples

### Real-time Code Analysis

```typescript
// Analyze document on save
vscode.workspace.onDidSaveTextDocument(async (document) => {
  if (document.languageId === 'leekscript') {
    const aiId = getAIIdFromPath(document.fileName);
    const code = document.getText();
    
    const result = await analyzerService.saveAI(aiId, code);
    if (result) {
      const errors = result.result[aiId.toString()];
      // Update diagnostics in VSCode
    }
  }
});
```

### Folder and File Management

```typescript
// Create folder structure
const folderId = await analyzerService.createFolder(0, "MyBots");

// Create AI in folder
const ai = await analyzerService.createAI(folderId, "fighter.leek");

// List all AIs in folder
const folderAIs = await analyzerService.listAIs(folderId);
```

### Error Handling

```typescript
const ai = await analyzerService.getAI(999999);
if (!ai) {
  console.log("AI not found - error was handled and logged");
}
```

## Server Requirements

The Code Analysis Server must be running:

```bash
java -jar generator.jar --start_code_server
```

- **URL**: `http://localhost:8080`
- **Port**: 8080
- **Persistence**: Automatic to `extension_server_ais/` directory

## Error Handling

All methods include comprehensive error handling:

- **ECONNREFUSED**: Server not running
- **404**: Resource not found
- **405**: Invalid HTTP method
- **500**: Server error

Errors are:
1. Logged to console with `[CodeAnalyzer]` prefix
2. Shown to user via VSCode notifications
3. Returned as `null` or `false` (methods don't throw)

## Best Practices

1. **Check server status** on extension activation
2. **Cache data** when possible to reduce API calls
3. **Handle null returns** - all methods return null on error
4. **Use TypeScript types** for type safety
5. **Monitor console logs** for debugging

## Integration Example

```typescript
// In extension.ts
import { CodeAnalyzerService } from './services/analyzer';

export async function activate(context: vscode.ExtensionContext) {
  const analyzerService = new CodeAnalyzerService(context);
  
  // Check server on startup
  if (!await analyzerService.checkServerStatus()) {
    vscode.window.showWarningMessage(
      'Code Analysis Server not running. Start server for code analysis.'
    );
  }
  
  // Make available to commands
  return { analyzerService };
}
```

## See Also

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Complete API reference
- [CodeAnalyzerService.ts](./CodeAnalyzerService.ts) - Source code

## License

Part of the LeekScript VSCode Extension project.
