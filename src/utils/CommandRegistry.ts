import * as vscode from "vscode";
import { LeekWarsService } from "../services/leekwars";
import { CodeAnalyzerService } from "../services/analyzer";
import { StatusBarService } from "../services/StatusBarService";
import { CodeBaseStateManager } from "../services/codebase";

/**
 * Manages registration of all extension commands
 */
export class CommandRegistry {
  constructor(
    private context: vscode.ExtensionContext,
    private leekWarsService: LeekWarsService,
    private analyzerService: CodeAnalyzerService,
    private statusBarService: StatusBarService,
    private codebaseStateManager: CodeBaseStateManager
  ) {}

  /**
   * Register all commands
   */
  registerAll(): void {
    this.registerLeekWarsCommands();
    this.registerStatusBarCommands();
    this.registerAnalyzerCommands();
    this.registerMiscCommands();
  }

  /**
   * Register LeekWars-related commands
   */
  private registerLeekWarsCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("leekscript.pullAllAIs", async () => {
        this.statusBarService.setBusy(true, "Pulling AIs...");
        try {
          await this.leekWarsService.pullAllAIs();
        } finally {
          this.statusBarService.setBusy(false);
        }
      })
    );
  }

  /**
   * Register status bar related commands
   */
  private registerStatusBarCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("leekscript.showStatusMenu", async () => {
        await this.statusBarService.showStatusMenu();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("leekscript.refreshStatus", async () => {
        // Re-check token status
        const tokenConfigured = this.leekWarsService.isTokenConfigured();
        this.statusBarService.setTokenStatus(tokenConfigured);

        // Re-check analyzer server status
        this.statusBarService.setBusy(true, "Checking status...");
        const serverRunning = await this.analyzerService.checkServerStatus();
        this.statusBarService.setAnalyzerServerStatus(serverRunning);
        this.statusBarService.setBusy(false);

        const message =
          serverRunning && tokenConfigured
            ? "All systems operational"
            : "Some features unavailable - check status menu for details";
        vscode.window.showInformationMessage(`LeekScript: ${message}`);
      })
    );
  }

  /**
   * Register Code Analyzer related commands
   */
  private registerAnalyzerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "leekscript.forceSyncCodeServer",
        async () => {
          // Confirm with user before proceeding
          const confirm = await vscode.window.showWarningMessage(
            "This will reset the Code Analysis Server and rebuild it from your LeekWars state. Continue?",
            { modal: true },
            "Yes",
            "No"
          );

          if (confirm !== "Yes") {
            return;
          }

          this.statusBarService.setBusy(true, "Syncing code server...");

          try {
            const result =
              await this.codebaseStateManager.forceSyncToAnalyzer();

            if (result.success) {
              vscode.window.showInformationMessage(
                `Code server sync complete! Created ${result.foldersCreated} folders and ${result.filesCreated} files.`
              );
            } else {
              const errorMsg = result.errors.join("\n");
              vscode.window.showErrorMessage(
                `Code server sync completed with errors:\n${errorMsg}`
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to sync code server: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          } finally {
            this.statusBarService.setBusy(false);
          }
        }
      )
    );
  }

  /**
   * Register miscellaneous commands
   */
  private registerMiscCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("leekscript.helloWorld", () => {
        vscode.window.showInformationMessage("Hello from LeekScript!");
      })
    );
  }
}
