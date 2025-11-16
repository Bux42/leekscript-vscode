import * as vscode from "vscode";
import { LeekWarsService } from "../services/leekwars";
import { CodeAnalyzerService } from "../services/analyzer";
import { StatusBarService } from "../services/StatusBarService";

/**
 * Manages registration of all extension commands
 */
export class CommandRegistry {
  constructor(
    private context: vscode.ExtensionContext,
    private leekWarsService: LeekWarsService,
    private analyzerService: CodeAnalyzerService,
    private statusBarService: StatusBarService
  ) {}

  /**
   * Register all commands
   */
  registerAll(): void {
    this.registerLeekWarsCommands();
    this.registerStatusBarCommands();
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
