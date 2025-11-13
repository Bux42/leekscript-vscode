import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  LeekWarsApiService,
  LeekWarsAIInfo,
  GetFarmerAIsResponse,
} from "./LeekWarsApi";

/**
 * Service for managing LeekWars AI synchronization
 */
export class LeekWarsService {
  private apiService: LeekWarsApiService | null = null;
  private lastResponse: GetFarmerAIsResponse | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get the API token from settings
   */
  private getToken(): string | null {
    const config = vscode.workspace.getConfiguration("leekscript");
    const token = config.get<string>("leekwarsApiToken", "");
    return token || null;
  }

  /**
   * Initialize the API service with the current token
   */
  private initializeApi(): boolean {
    const token = this.getToken();
    if (!token) {
      vscode.window.showErrorMessage(
        "LeekWars API token not configured. Please set it in settings."
      );
      return false;
    }

    this.apiService = new LeekWarsApiService(token);
    return true;
  }

  /**
   * Pull all AIs from LeekWars and save them locally
   */
  async pullAllAIs(): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Pulling AIs from LeekWars",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Fetching AI list..." });

          const response = await this.apiService!.getFarmerAIs();

          console.log("[LeekWars Service] getFarmerAIs response:", response);

          if (!response.ais) {
            const errorMsg = response.error || "Failed to fetch AI list";
            console.error("[LeekWars Service] Error:", errorMsg);
            console.error(
              "[LeekWars Service] Full response:",
              JSON.stringify(response, null, 2)
            );
            throw new Error(
              `Failed to fetch AI list: ${errorMsg}. Check Developer Tools Console for details.`
            );
          }

          // Store the response for later use
          this.lastResponse = response;

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

          if (!workspaceFolder) {
            throw new Error("No workspace folder open");
          }

          const leekwarsDir = path.join(workspaceFolder.uri.fsPath, "leekwars");

          // Create leekwars root directory if it doesn't exist
          if (!fs.existsSync(leekwarsDir)) {
            fs.mkdirSync(leekwarsDir, { recursive: true });
          }

          // Create folder structure
          progress.report({ message: "Creating folder structure..." });
          this.createFolderStructure(leekwarsDir, response.folders);

          vscode.window.showInformationMessage(
            `Successfully created ${response.folders.length} folder(s) from LeekWars`
          );
        }
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to pull AIs: ${error.message}`);
    }
  }

  /**
   * Create the folder structure based on LeekWars folders
   */
  private createFolderStructure(
    baseDir: string,
    folders: Array<{ id: number; name: string; folder: number }>
  ): void {
    // Map folder IDs to their paths
    const folderPaths = new Map<number, string>();
    folderPaths.set(0, baseDir); // Root folder ID 0 maps to base directory

    // Create folders level by level
    let currentLevelFolders = folders.filter((f) => f.folder === 0); // Start with root folders
    let processedFolders = new Set<number>();

    while (currentLevelFolders.length > 0) {
      const nextLevelFolders: typeof folders = [];

      for (const folder of currentLevelFolders) {
        // Get parent path
        const parentPath = folderPaths.get(folder.folder);
        if (!parentPath) {
          console.warn(
            `[LeekWars Service] Parent folder ${folder.folder} not found for ${folder.name}`
          );
          continue;
        }

        // Create current folder path
        const folderPath = path.join(parentPath, folder.name);

        // Create the folder
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
          console.log(`[LeekWars Service] Created folder: ${folderPath}`);
        }

        // Store the path
        folderPaths.set(folder.id, folderPath);
        processedFolders.add(folder.id);

        // Find children for next level
        const children = folders.filter(
          (f) => f.folder === folder.id && !processedFolders.has(f.id)
        );
        nextLevelFolders.push(...children);
      }

      currentLevelFolders = nextLevelFolders;
    }
  }

  /**
   * Pull a specific AI from LeekWars
   */
  async pullAI(aiId: number): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Pulling AI from LeekWars",
          cancellable: false,
        },
        async (progress) => {
          const response = await this.apiService!.getAI(aiId);

          console.log(`[LeekWars Service] getAI(${aiId}) response:`, response);

          if (!response.success || !response.ai) {
            const errorMsg = response.error || "Failed to fetch AI";
            console.error("[LeekWars Service] Error:", errorMsg);
            throw new Error(
              `Failed to fetch AI: ${errorMsg}. Check Developer Tools Console for details.`
            );
          }

          const ai = response.ai;
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

          if (!workspaceFolder) {
            throw new Error("No workspace folder open");
          }

          const leekwarsDir = path.join(workspaceFolder.uri.fsPath, "leekwars");

          if (!fs.existsSync(leekwarsDir)) {
            fs.mkdirSync(leekwarsDir, { recursive: true });
          }

          const aiFilePath = path.join(leekwarsDir, `${ai.name}.leek`);

          // Add metadata as comment at the top
          const metadata = `// LeekWars AI: ${ai.name}\n// AI ID: ${ai.id}\n// Valid: ${ai.valid}\n\n`;
          const content = metadata + ai.code;

          fs.writeFileSync(aiFilePath, content, "utf8");

          vscode.window.showInformationMessage(
            `Successfully pulled AI: ${ai.name}`
          );

          // Open the file
          const document = await vscode.workspace.openTextDocument(aiFilePath);
          await vscode.window.showTextDocument(document);
        }
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to pull AI: ${error.message}`);
    }
  }

  /**
   * Show a quick pick to select and pull an AI
   */
  async selectAndPullAI(): Promise<void> {
    if (!this.initializeApi()) {
      return;
    }

    try {
      const response = await this.apiService!.getFarmerAIs();

      console.log("[LeekWars Service] selectAndPullAI response:", response);

      if (!response.success || !response.ais) {
        const errorMsg = response.error || "Failed to fetch AI list";
        console.error("[LeekWars Service] Error:", errorMsg);
        throw new Error(
          `Failed to fetch AI list: ${errorMsg}. Check Developer Tools Console for details.`
        );
      }

      const aiInfos = response.ais;

      if (aiInfos.length === 0) {
        vscode.window.showInformationMessage(
          "No AIs found on your LeekWars account"
        );
        return;
      }

      const items = aiInfos.map((ai) => ({
        label: ai.name,
        description: `ID: ${ai.id} | ${ai.valid ? "✓ Valid" : "✗ Invalid"}`,
        ai: ai,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an AI to pull from LeekWars",
      });

      if (selected) {
        await this.pullAI(selected.ai.id);
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch AI list: ${error.message}`
      );
    }
  }
}
