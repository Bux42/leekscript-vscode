# LeekWars Service

Service for pulling LeekScript AI code from the LeekWars website into VSCode.

## Features

- **Pull All AIs**: Download all your AIs from LeekWars to a local `leekwars/` folder
- **Pull Specific AI**: Select and download a specific AI from a list

## Setup

1. Get your LeekWars API token from [leekwars.com](https://leekwars.com)

   - Log in to LeekWars
   - Go to Settings → API
   - Copy your API token

2. Configure the token in VSCode:
   - Open VSCode Settings (Ctrl+, / Cmd+,)
   - Search for "leekwars api token"
   - Paste your token (it will be masked as a password)

## Usage

### Pull All AIs

**Command Palette**: `LeekWars: Pull All AIs`

Downloads all your AIs from LeekWars and saves them in a `leekwars/` folder in your workspace. Each AI is saved as `<AI_Name>.leek` with metadata comments at the top:

```leekscript
// LeekWars AI: MyAI
// AI ID: 12345
// Valid: true

// Your code here...
```

### Pull Single AI

**Command Palette**: `LeekWars: Pull AI`

Opens a quick pick menu showing all your AIs. Select one to download it and open it in the editor.

## API Endpoints Used

- `GET /api/ai/get-farmer-ais` - Get list of all AIs
- `GET /api/ai/get?ai_id=X` - Get specific AI code

## File Structure

```
src/services/leekwars/
├── LeekWarsApi.ts         # Low-level API client
├── LeekWarsService.ts     # High-level pull operations
├── index.ts               # Exports
└── README.md              # Documentation
```

## Error Handling

- Shows error notifications for failed API calls
- Validates workspace folder exists
- Checks for API token configuration
- Creates `leekwars/` folder if it doesn't exist

- Validates token configuration before operations
- Checks for workspace folder before saving files
- Validates `.leek` files have required metadata before pushing
