import * as vscode from "vscode";
import { DiagnosticService } from "../services/DiagnosticService";

/**
 * Handles all document-related events
 */
export class DocumentEventHandler {
  constructor(
    private context: vscode.ExtensionContext,
    private diagnosticService: DiagnosticService
  ) {}

  /**
   * Register all document event listeners
   */
  registerAll(): void {
    this.registerSaveListener();
    this.registerDeleteListener();
    this.registerOpenListener();
    this.registerChangeListener();
    this.registerCloseListener();
  }

  /**
   * Register file save listener
   */
  private registerSaveListener(): void {
    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        if (!this.isLeekScriptDocument(document)) {
          return;
        }

        const uri = document.uri.toString();

        // Clear any pending debounce timer for immediate analysis on save
        this.diagnosticService.clearDebounceTimer(uri);

        // Analyze the document immediately
        await this.diagnosticService.analyzeDocument(document);

        // Get relative path
        const relativePath = this.getRelativePath(document.uri);
        console.log(`LeekScript file saved: ${relativePath}`);

        // TODO: Send content to local server if needed
      }
    );

    this.context.subscriptions.push(saveListener);
  }

  /**
   * Register file/folder delete listener
   */
  private registerDeleteListener(): void {
    const deleteListener = vscode.workspace.onDidDeleteFiles((event) => {
      event.files.forEach((uri) => {
        const relativePath = this.getRelativePath(uri);
        const filePath = uri.fsPath;

        if (filePath.endsWith(".leek")) {
          console.log(`LeekScript file deleted: ${relativePath}`);
        } else {
          console.log(
            `Folder or file deleted: ${relativePath} (may have contained .leek files)`
          );
        }
      });
    });

    this.context.subscriptions.push(deleteListener);
  }

  /**
   * Register document open listener
   */
  private registerOpenListener(): void {
    const openListener = vscode.workspace.onDidOpenTextDocument(
      async (document) => {
        if (this.isLeekScriptDocument(document)) {
          await this.diagnosticService.analyzeDocument(document);
        }
      }
    );

    this.context.subscriptions.push(openListener);
  }

  /**
   * Register document change listener for real-time analysis with debouncing
   */
  private registerChangeListener(): void {
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (this.isLeekScriptDocument(document)) {
        this.diagnosticService.analyzeDocumentDebounced(document);
      }
    });

    this.context.subscriptions.push(changeListener);
  }

  /**
   * Register document close listener
   */
  private registerCloseListener(): void {
    const closeListener = vscode.workspace.onDidCloseTextDocument(
      (document) => {
        const uri = document.uri.toString();

        // Clear any pending debounce timer
        this.diagnosticService.clearDebounceTimer(uri);
        console.log(`LeekScript document closed: ${document.fileName}`);
      }
    );

    this.context.subscriptions.push(closeListener);
  }

  /**
   * Analyze all currently open documents
   */
  async analyzeOpenDocuments(): Promise<void> {
    for (const document of vscode.workspace.textDocuments) {
      if (this.isLeekScriptDocument(document)) {
        await this.diagnosticService.analyzeDocument(document);
      }
    }
  }

  /**
   * Check if a document is a LeekScript document
   */
  private isLeekScriptDocument(document: vscode.TextDocument): boolean {
    return (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    );
  }

  /**
   * Get relative path for a URI
   */
  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder
      ? vscode.workspace.asRelativePath(uri, false)
      : uri.fsPath;
  }
}
