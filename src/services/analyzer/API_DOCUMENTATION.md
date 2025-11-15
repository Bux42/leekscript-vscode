# LeekScript Code Analysis Server - API Documentation

## Overview

The LeekScript Code Analysis Server is an HTTP server that maintains a local replica of your LeekScript codebase, processes file and folder operations, and runs real-time code analysis to detect errors. The server runs on **port 8080** and provides a REST API for managing AI files, folders, and code analysis.

## Server Information

- **Base URL**: `http://localhost:8080`
- **Port**: 8080
- **Content-Type**: `application/json` (for all requests)
- **Persistence**: All state is automatically persisted to disk in the `extension_server_ais/` directory

## Table of Contents

1. [Server Status](#server-status)
2. [Owner Management](#owner-management)
3. [AI File Operations](#ai-file-operations)
4. [Folder Operations](#folder-operations)
5. [Error Handling](#error-handling)
6. [Data Structures](#data-structures)
7. [Persistence](#persistence)

---

## Server Status

### GET `/`

Check if the server is running.

**Response** (200 OK):

```
LeekScript Code Analysis Server is running
```

---

## Owner Management

### POST `/api/owner/set-id`

Set the owner (farmer) ID for the codebase. This recreates the root folder with the new owner.

**Request Body**:

```json
{
  "owner_id": 12345
}
```

**Response** (200 OK):

```json
[]
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/owner/set-id \
  -H "Content-Type: application/json" \
  -d '{"owner_id":12345}'
```

---

### GET `/api/owner/get-id`

Retrieve the current owner ID.

**Response** (200 OK):

```json
{
  "owner_id": 12345
}
```

**Example**:

```bash
curl http://localhost:8080/api/owner/get-id
```

---

## AI File Operations

### POST `/api/ai/new-name`

Create a new AI file with default code.

**Request Body**:

```json
{
  "folder_id": 0,
  "version": 4,
  "name": "myAI.leek"
}
```

**Parameters**:

- `folder_id` (integer): Parent folder ID (0 for root)
- `version` (integer, optional): LeekScript version (default: 4)
- `name` (string): Name of the AI file (should end with `.leek`)

**Response** (200 OK):

```json
{
  "ai": {
    "id": 1000000,
    "name": "myAI.leek",
    "level": 1,
    "code": "/**\n * Bienvenue sur Leek Wars !\n * ...\n**/\n...",
    "folder": 0
  }
}
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai/new-name \
  -H "Content-Type: application/json" \
  -d '{"folder_id":0,"version":4,"name":"myAI.leek"}'
```

---

### POST `/api/ai/save`

Save code to an AI file and run analysis to detect errors.

**Request Body**:

```json
{
  "ai_id": 1000000,
  "code": "var x = 5;\nvar y = 10;\nvar z = x + y;"
}
```

**Parameters**:

- `ai_id` (integer): The AI file ID
- `code` (string): The LeekScript code to save

**Response** (200 OK):

```json
{
  "result": {
    "1000000": []
  },
  "modified": 1763150074820
}
```

**Response with Errors**:

```json
{
  "result": {
    "1000000": [
      [0, 1000000, 1, 9, 1, 10, 24, []],
      [1, 1000000, 3, 1, 3, 5, 15, ["variable_x"]]
    ]
  },
  "modified": 1763150074820
}
```

**Error Format**: `[level, ai_id, start_line, start_column, end_line, end_column, error_code, [parameters]]`

- `level`: 0 = error, 1 = warning
- `ai_id`: The AI file ID
- `start_line`, `start_column`: Error start position
- `end_line`, `end_column`: Error end position
- `error_code`: Numeric error code
- `parameters`: Optional array of error-specific parameters

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai/save \
  -H "Content-Type: application/json" \
  -d '{"ai_id":1000000,"code":"var x = 5;"}'
```

---

### POST `/api/ai/rename`

Rename an AI file.

**Request Body**:

```json
{
  "ai_id": 1000000,
  "new_name": "renamedAI.leek"
}
```

**Parameters**:

- `ai_id` (integer): The AI file ID
- `new_name` (string): New name for the AI file

**Response** (200 OK):

```json
[]
```

**Error Response** (404 Not Found):

```json
"AI not found: AI file with id 1000000 not found"
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai/rename \
  -H "Content-Type: application/json" \
  -d '{"ai_id":1000000,"new_name":"renamedAI.leek"}'
```

---

### DELETE `/api/ai/delete`

Delete an AI file.

**Request Body**:

```json
{
  "ai_id": 1000000
}
```

**Parameters**:

- `ai_id` (integer): The AI file ID to delete

**Response** (200 OK):

```json
[]
```

**Example**:

```bash
curl -X DELETE http://localhost:8080/api/ai/delete \
  -H "Content-Type: application/json" \
  -d '{"ai_id":1000000}'
```

---

### POST `/api/ai/change-folder`

Move an AI file to a different folder.

**Request Body**:

```json
{
  "ai_id": 1000000,
  "folder_id": 5
}
```

**Parameters**:

- `ai_id` (integer): The AI file ID to move
- `folder_id` (integer): Destination folder ID (0 for root)

**Response** (200 OK):

```json
[]
```

**Error Response** (404 Not Found):

```json
"AI file with id 1000000 not found"
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai/change-folder \
  -H "Content-Type: application/json" \
  -d '{"ai_id":1000000,"folder_id":5}'
```

---

### GET `/api/ai/get`

Retrieve information about a specific AI file.

**Query Parameters**:

- `ai_id` (integer): The AI file ID

**Response** (200 OK):

```json
{
  "id": 1000000,
  "name": "myAI.leek",
  "folder_id": 0,
  "code": "var x = 5;",
  "version": 4
}
```

**Error Response** (404 Not Found):

```json
"AI file with id 1000000 not found"
```

**Example**:

```bash
curl http://localhost:8080/api/ai/get?ai_id=1000000
```

---

### GET `/api/ai/list`

List all AI files, optionally filtered by folder.

**Query Parameters** (optional):

- `folder_id` (integer): Filter by folder ID

**Response** (200 OK):

```json
{
  "ais": [
    {
      "id": 1000000,
      "name": "myAI.leek",
      "folder_id": 0,
      "version": 4
    },
    {
      "id": 1000001,
      "name": "anotherAI.leek",
      "folder_id": 0,
      "version": 4
    }
  ]
}
```

**Example**:

```bash
# List all AIs
curl http://localhost:8080/api/ai/list

# List AIs in a specific folder
curl http://localhost:8080/api/ai/list?folder_id=5
```

---

## Folder Operations

### POST `/api/ai-folder/new-name`

Create a new folder.

**Request Body**:

```json
{
  "folder_id": 0,
  "name": "MyFolder"
}
```

**Parameters**:

- `folder_id` (integer): Parent folder ID (0 for root)
- `name` (string): Name of the new folder

**Response** (200 OK):

```json
{
  "id": 3
}
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai-folder/new-name \
  -H "Content-Type: application/json" \
  -d '{"folder_id":0,"name":"MyFolder"}'
```

---

### POST `/api/ai-folder/rename`

Rename a folder.

**Request Body**:

```json
{
  "folder_id": 3,
  "new_name": "RenamedFolder"
}
```

**Parameters**:

- `folder_id` (integer): The folder ID to rename
- `new_name` (string): New name for the folder

**Response** (200 OK):

```json
[]
```

**Error Response** (404 Not Found):

```json
"Folder not found: Folder with id 3 not found"
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai-folder/rename \
  -H "Content-Type: application/json" \
  -d '{"folder_id":3,"new_name":"RenamedFolder"}'
```

---

### DELETE `/api/ai-folder/delete`

Delete a folder and all its contents (cascade delete).

**Request Body**:

```json
{
  "folder_id": 3
}
```

**Parameters**:

- `folder_id` (integer): The folder ID to delete

**Response** (200 OK):

```json
[]
```

**Note**: This operation performs a cascade delete:

- All AI files in the folder are deleted
- All subfolders and their contents are recursively deleted

**Example**:

```bash
curl -X DELETE http://localhost:8080/api/ai-folder/delete \
  -H "Content-Type: application/json" \
  -d '{"folder_id":3}'
```

---

### POST `/api/ai-folder/change-folder`

Move a folder to a different parent folder.

**Request Body**:

```json
{
  "folder_id": 3,
  "dest_folder_id": 5
}
```

**Parameters**:

- `folder_id` (integer): The folder ID to move
- `dest_folder_id` (integer): Destination parent folder ID (0 for root)

**Response** (200 OK):

```json
[]
```

**Error Response** (404 Not Found):

```json
"Folder with id 3 not found"
```

**Example**:

```bash
curl -X POST http://localhost:8080/api/ai-folder/change-folder \
  -H "Content-Type: application/json" \
  -d '{"folder_id":3,"dest_folder_id":5}'
```

---

### GET `/api/ai-folder/get`

Retrieve information about a specific folder.

**Query Parameters**:

- `folder_id` (integer): The folder ID

**Response** (200 OK):

```json
{
  "id": 3,
  "name": "MyFolder",
  "parent_id": 0
}
```

**Error Response** (404 Not Found):

```json
"Folder with id 3 not found"
```

**Example**:

```bash
curl http://localhost:8080/api/ai-folder/get?folder_id=3
```

---

### GET `/api/ai-folder/list`

List all folders.

**Response** (200 OK):

```json
{
  "folders": [
    {
      "id": 1,
      "name": "Folder1",
      "parent_id": 0
    },
    {
      "id": 2,
      "name": "Folder2",
      "parent_id": 0
    },
    {
      "id": 3,
      "name": "Subfolder",
      "parent_id": 1
    }
  ]
}
```

**Example**:

```bash
curl http://localhost:8080/api/ai-folder/list
```

---

## Error Handling

### HTTP Status Codes

- **200 OK**: Request successful
- **404 Not Found**: Resource (AI file or folder) not found
- **405 Method Not Allowed**: Wrong HTTP method used
- **500 Internal Server Error**: Server error occurred

### Error Response Format

Error responses return a plain text message describing the error:

```
"AI file with id 1000000 not found"
```

or

```
"Folder not found: Folder with id 3 not found"
```

---

## Data Structures

### AI File Object

```json
{
  "id": 1000000,
  "name": "myAI.leek",
  "folder_id": 0,
  "code": "var x = 5;",
  "version": 4,
  "level": 1
}
```

**Fields**:

- `id` (integer): Unique AI file identifier (starts at 1000000)
- `name` (string): File name
- `folder_id` (integer): Parent folder ID (0 = root)
- `code` (string): LeekScript source code
- `version` (integer): LeekScript version (typically 4)
- `level` (integer): AI level (always 1 for new AIs)

### Folder Object

```json
{
  "id": 3,
  "name": "MyFolder",
  "parent_id": 0
}
```

**Fields**:

- `id` (integer): Unique folder identifier (starts at 1)
- `name` (string): Folder name
- `parent_id` (integer): Parent folder ID (0 = root)

### Analysis Error Format

```json
[0, 1000000, 1, 9, 1, 10, 24, []]
```

**Array Elements** (in order):

1. `level` (integer): 0 = error, 1 = warning
2. `ai_id` (integer): The AI file ID
3. `start_line` (integer): Error start line number
4. `start_column` (integer): Error start column number
5. `end_line` (integer): Error end line number
6. `end_column` (integer): Error end column number
7. `error_code` (integer): Numeric error code identifying the type of error
8. `parameters` (array): Optional array of error-specific parameters (e.g., variable names)

---

## Persistence

### Automatic State Persistence

All state changes are automatically persisted to disk in the `extension_server_ais/` directory:

```
extension_server_ais/
├── metadata.json          # Owner ID, folder structure, AI metadata, next IDs
└── ais/
    ├── 1000000.leek      # AI file code
    ├── 1000001.leek      # AI file code
    └── ...
```

### Metadata Structure

The `metadata.json` file contains:

```json
{
  "owner_id": 12345,
  "next_ai_id": 1000023,
  "next_folder_id": 10,
  "folders": [
    {
      "id": 1,
      "name": "TestFolder",
      "parent_id": 0,
      "timestamp": 1763150074865
    }
  ],
  "ais": [
    {
      "id": 1000000,
      "name": "myAI.leek",
      "folder_id": 0,
      "version": 4,
      "timestamp": 1763150074788,
      "strict": false
    }
  ]
}
```

### State Restoration

When the server starts:

1. It checks for existing state in `extension_server_ais/`
2. If found, it loads the owner ID, folder structure, and AI files
3. If not found, it starts with a fresh empty state

**Console Output on Startup**:

```
Storage initialized at: D:\Github\leek-wars-generator-recursive\extension_server_ais
State loaded: 19 AIs, 6 folders, owner=12345
LeekScript Code Analysis Server started on port 8080
Ready to receive requests...
```

---

## Usage Examples

### Complete Workflow Example

```bash
# 1. Set owner ID
curl -X POST http://localhost:8080/api/owner/set-id \
  -H "Content-Type: application/json" \
  -d '{"owner_id":12345}'

# 2. Create a folder
curl -X POST http://localhost:8080/api/ai-folder/new-name \
  -H "Content-Type: application/json" \
  -d '{"folder_id":0,"name":"MyAIs"}'
# Response: {"id":1}

# 3. Create an AI file
curl -X POST http://localhost:8080/api/ai/new-name \
  -H "Content-Type: application/json" \
  -d '{"folder_id":1,"version":4,"name":"fighter.leek"}'
# Response: {"ai":{"id":1000000,"name":"fighter.leek","level":1,"code":"...","folder":1}}

# 4. Save code and analyze
curl -X POST http://localhost:8080/api/ai/save \
  -H "Content-Type: application/json" \
  -d '{"ai_id":1000000,"code":"setWeapon(WEAPON_LASER);\nvar enemy = getNearestEnemy();\nuseWeapon(enemy);"}'
# Response: {"result":{"1000000":[]},"modified":1763150074820}

# 5. List all AIs
curl http://localhost:8080/api/ai/list

# 6. Get specific AI
curl http://localhost:8080/api/ai/get?ai_id=1000000

# 7. List all folders
curl http://localhost:8080/api/ai-folder/list
```

### Include Statement Resolution

The server automatically resolves include statements when analyzing code:

```javascript
// utils.leek
function add(a, b) {
  return a + b;
}

// main.leek
include("utils.leek");
var result = add(5, 3); // Resolves correctly
```

Include paths support:

- Simple names: `include("utils.leek")` or `include("utils")`
- Folder paths: `include("libs/utils.leek")`
- Relative paths: `include("../utils.leek")`

---

## Notes

- **AI IDs**: Start at 1000000 and increment automatically
- **Folder IDs**: Start at 1 and increment automatically (0 is reserved for root)
- **Thread Safety**: The current implementation is not thread-safe for concurrent requests
- **Code Analysis**: Runs automatically on every save operation
- **Default Code**: New AI files are created with French welcome template code
- **Cascade Delete**: Deleting a folder removes all its contents recursively

---

## Server Startup

To start the server:

```bash
java -jar generator.jar --start_code_server
```

To start the server with automated tests:

```bash
java -jar generator.jar --start_code_server --start_tests
```

The server will:

1. Initialize storage directory
2. Load any saved state from disk
3. Start HTTP server on port 8080
4. (If `--start_tests` flag) Run automated test suite
5. Begin accepting requests

---

## Testing

The server includes a comprehensive test suite with 20 automated tests covering:

- Server status check
- Owner ID management
- AI file CRUD operations
- Valid and invalid code analysis
- Folder management and hierarchy
- Include statement resolution
- Error handling for invalid IDs
- Complex include chains
- Cascade folder deletion
- Large code files

Run tests with:

```bash
java -jar generator.jar --start_code_server --start_tests
```

---

## Troubleshooting

### Server won't start

- Check if port 8080 is already in use
- Ensure Java is properly installed
- Verify `generator.jar` exists

### State not persisting

- Check write permissions for `extension_server_ais/` directory
- Look for error messages in console output
- Verify disk space availability

### Analysis errors not showing

- Ensure code is being saved with `/api/ai/save` endpoint
- Check console output for analysis completion messages
- Verify LeekScript syntax is correct

### Include statements not resolving

- Ensure included files exist in the codebase
- Check file paths are correct (case-sensitive)
- Verify files are in the correct folders

---

## License & Credits

This server is part of the Leek Wars Generator project and uses the LeekScript compiler for code analysis.
