import * as vscode from "vscode";

/**
 * Status level for the extension
 */
export enum StatusLevel {
  Good = "good", // Everything is working (notebook-mimetype icon)
  Warning = "warning", // Some issues (testing-error-icon, orange)
  Error = "error", // Critical issues (testing-error-icon, orange)
  Busy = "busy", // Processing request (spinner)
}

/**
 * Status information for display
 */
interface StatusInfo {
  analyzerServerRunning: boolean;
  tokenConfigured: boolean;
  isBusy: boolean;
  busyMessage?: string;
}

/**
 * Service to manage the status bar item for the extension
 */
export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;
  private statusInfo: StatusInfo = {
    analyzerServerRunning: false,
    tokenConfigured: false,
    isBusy: false,
  };

  constructor(private context: vscode.ExtensionContext) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    // Set command for clicking the status bar
    this.statusBarItem.command = "leekscript.showStatusMenu";

    // Initial update
    this.updateStatusBar();

    // Show the status bar item
    this.statusBarItem.show();

    // Add to subscriptions for cleanup
    context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Update analyzer server status
   */
  setAnalyzerServerStatus(isRunning: boolean): void {
    this.statusInfo.analyzerServerRunning = isRunning;
    this.updateStatusBar();
  }

  /**
   * Update token configuration status
   */
  setTokenStatus(isConfigured: boolean): void {
    this.statusInfo.tokenConfigured = isConfigured;
    this.updateStatusBar();
  }

  /**
   * Set busy state with optional message
   */
  setBusy(isBusy: boolean, message?: string): void {
    this.statusInfo.isBusy = isBusy;
    this.statusInfo.busyMessage = message;
    this.updateStatusBar();
  }

  /**
   * Get the current status level
   */
  private getStatusLevel(): StatusLevel {
    // Busy state takes precedence
    if (this.statusInfo.isBusy) {
      return StatusLevel.Busy;
    }

    // Check for critical issues (red)
    if (!this.statusInfo.tokenConfigured) {
      return StatusLevel.Error;
    }

    // Check for warnings (orange)
    if (!this.statusInfo.analyzerServerRunning) {
      return StatusLevel.Warning;
    }

    // Everything is good (white)
    return StatusLevel.Good;
  }

  /**
   * Update the status bar item appearance
   */
  private updateStatusBar(): void {
    const level = this.getStatusLevel();

    // Update icon and text based on status
    if (level === StatusLevel.Busy) {
      this.statusBarItem.text = `$(sync~spin) ${
        this.statusInfo.busyMessage || "LeekScript"
      }`;
      this.statusBarItem.tooltip = "LeekScript: Processing...";
      this.statusBarItem.color = undefined;
    } else {
      let icon: string;
      let tooltip: string;
      let color: string | vscode.ThemeColor | undefined;

      switch (level) {
        case StatusLevel.Good:
          icon = "$(notebook-mimetype)";
          tooltip = "LeekScript: All systems operational";
          color = undefined;
          break;
        case StatusLevel.Warning:
        case StatusLevel.Error:
          icon = "$(testing-error-icon)";
          tooltip =
            level === StatusLevel.Error
              ? "LeekScript: Configuration required"
              : "LeekScript: Some features unavailable";
          color = new vscode.ThemeColor("editorWarning.foreground");
          break;
        default:
          icon = "$(notebook-mimetype)";
          tooltip = "LeekScript";
          color = undefined;
      }

      this.statusBarItem.text = `${icon} LeekScript`;
      this.statusBarItem.tooltip = tooltip;
      this.statusBarItem.color = color;
    }
  }

  /**
   * Get current status information
   */
  getStatusInfo(): StatusInfo {
    return { ...this.statusInfo };
  }

  /**
   * Show status menu with options
   */
  async showStatusMenu(): Promise<void> {
    const level = this.getStatusLevel();
    const items: vscode.QuickPickItem[] = [];

    // Status header
    // items.push({
    //   label: "$(info) Status Information",
    //   kind: vscode.QuickPickItemKind.Separator,
    // });

    // Analyzer server status
    const analyzerIcon = this.statusInfo.analyzerServerRunning
      ? "$(check)"
      : "$(x)";
    items.push({
      label: `${analyzerIcon} Code Analysis Server`,
      description: this.statusInfo.analyzerServerRunning
        ? "Running"
        : "Not running",
      detail: this.statusInfo.analyzerServerRunning
        ? "Real-time code analysis is available"
        : "Start the server to enable real-time code analysis",
    });

    // Token status
    const tokenIcon = this.statusInfo.tokenConfigured ? "$(check)" : "$(x)";
    items.push({
      label: `${tokenIcon} LeekWars API Token`,
      description: this.statusInfo.tokenConfigured
        ? "Configured"
        : "Not configured",
      detail: this.statusInfo.tokenConfigured
        ? "API requests are enabled"
        : "Configure token to enable API features",
    });

    // Actions separator
    items.push({
      label: "Actions",
      kind: vscode.QuickPickItemKind.Separator,
    });

    // Action items based on status
    if (!this.statusInfo.tokenConfigured) {
      items.push({
        label: "$(settings-gear) Configure LeekWars Token",
        description: "Open settings to configure API token",
        detail: "Required for pulling AIs from LeekWars",
      });
    }

    if (!this.statusInfo.analyzerServerRunning) {
      items.push({
        label: "$(info) Start Analysis Server",
        description: "Instructions to start the server",
        detail: "Run: java -jar generator.jar --start_code_server",
      });
    }

    // Always show these options
    items.push({
      label: "$(refresh) Refresh Status",
      description: "Check server and token status",
      detail: "Re-check all system components",
    });

    items.push({
      label: "$(settings) Extension Settings",
      description: "Open LeekScript extension settings",
      detail: "Configure all extension options",
    });

    // Show quick pick
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `LeekScript Status - ${this.getStatusDescription(level)}`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    // Handle selection
    if (selected) {
      await this.handleMenuSelection(selected.label);
    }
  }

  /**
   * Get human-readable status description
   */
  private getStatusDescription(level: StatusLevel): string {
    switch (level) {
      case StatusLevel.Good:
        return "All systems operational";
      case StatusLevel.Warning:
        return "Some features unavailable";
      case StatusLevel.Error:
        return "Configuration required";
      case StatusLevel.Busy:
        return "Processing...";
      default:
        return "Unknown";
    }
  }

  /**
   * Handle menu item selection
   */
  private async handleMenuSelection(label: string): Promise<void> {
    if (label.includes("Configure LeekWars Token")) {
      // Open settings to token configuration
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "leekscript.leekwarsApiToken"
      );
    } else if (label.includes("Start Analysis Server")) {
      // Show instructions
      const openDocs = "View Documentation";
      const result = await vscode.window.showInformationMessage(
        "To start the Code Analysis Server, run:\njava -jar generator.jar --start_code_server",
        openDocs
      );

      if (result === openDocs) {
        // Could open documentation if available
        vscode.env.openExternal(
          vscode.Uri.parse("https://github.com/leek-wars")
        );
      }
    } else if (label.includes("Refresh Status")) {
      // Trigger status refresh
      await vscode.commands.executeCommand("leekscript.refreshStatus");
    } else if (label.includes("Extension Settings")) {
      // Open extension settings
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:your-publisher.leekscript"
      );
    }
  }

  /**
   * Dispose the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
