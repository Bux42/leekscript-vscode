import * as vscode from "vscode";
import * as path from "path";
import { CodeAnalyzerService, AnalysisError } from "../services/analyzer";
import { DataLoader } from "../utils/DataLoader";
import { CodeBaseStateManager } from "./codebase";

/**
 * Debounce delay in milliseconds
 */
const DEBOUNCE_DELAY = 500;

/**
 * Service for managing diagnostics and code analysis
 */
export class DiagnosticService {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private analyzerService: CodeAnalyzerService;
  private dataLoader: DataLoader;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private globalState: CodeBaseStateManager;

  constructor(
    diagnosticCollection: vscode.DiagnosticCollection,
    analyzerService: CodeAnalyzerService,
    dataLoader: DataLoader,
    codebaseStateManager: CodeBaseStateManager
  ) {
    this.diagnosticCollection = diagnosticCollection;
    this.analyzerService = analyzerService;
    this.dataLoader = dataLoader;
    this.globalState = codebaseStateManager;
  }

  /**
   * Format error message by replacing {0}, {1}, etc. with parameters
   */
  private formatErrorMessage(template: string, params: string[]): string {
    let message = template;

    if (!params || params.length === 0) {
      return message;
    }

    for (let i = 0; i < params.length; i++) {
      message = message.replace(new RegExp(`\\{${i}\\}`, "g"), params[i]);
    }
    return message;
  }

  /**
   * Convert analysis errors to VSCode diagnostics
   */
  private convertAnalysisErrorsToDiagnostics(
    errors: AnalysisError[]
  ): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const leekscriptConstants = this.dataLoader.getLeekScriptConstants();

    for (const error of errors) {
      const [
        level,
        aiId,
        startLine,
        startCol,
        endLine,
        endCol,
        errorCode,
        params,
      ] = error;

      // Convert to 0-based indexing (server uses 1-based)
      const range = new vscode.Range(
        Math.max(0, startLine - 1),
        Math.max(0, startCol - 1),
        Math.max(0, endLine - 1),
        Math.max(0, endCol - 1)
      );

      const severity =
        level === 0
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;

      // Get the error message template and format it with parameters
      const errorKey = `error_${errorCode}`;
      const errorTemplate = leekscriptConstants[errorKey];
      let message: string;

      console.log("error: ", error, errorTemplate, params);

      if (errorTemplate) {
        message = this.formatErrorMessage(errorTemplate, params);
      } else {
        // Fallback if error code is unknown
        message =
          params.length > 0
            ? `[${errorCode}] ${params.join(", ")}`
            : `Error code: ${errorCode}`;
      }

      const diagnostic = new vscode.Diagnostic(range, message, severity);
      diagnostic.source = "LeekScript Analyzer";
      diagnostic.code = errorCode;

      diagnostics.push(diagnostic);
    }

    return diagnostics;
  }

  /**
   * Analyze a LeekScript document
   */
  async analyzeDocument(document: vscode.TextDocument): Promise<void> {
    if (
      document.languageId !== "leekscript" &&
      !document.fileName.endsWith(".leek")
    ) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;

    // If analyzer service is not available or server is not running, skip analysis
    if (!this.analyzerService.getServerStatus()) {
      return;
    }

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.error("[LeekScript] No workspace folder found");
      return;
    }

    try {
      // Get relative path from workspace
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      let relativePath = path.relative(workspaceRoot, document.fileName);

      // Normalize path separators to forward slashes
      relativePath = relativePath.replace(/\\/g, "/");

      // Prepend "user-code/"
      const filePath = `user-code/${relativePath}`;

      // Analyze file with new endpoint (file must be saved on disk)
      const result = await this.analyzerService.analyzeFile(filePath);

      if (result) {
        const diagnostics = this.convertAnalysisErrorsToDiagnostics(
          result.errors
        );

        // Update diagnostics for this document
        this.diagnosticCollection.set(document.uri, diagnostics);

        const errorCount = result.errors.filter((e) => e[0] === 0).length;
        const warningCount = result.errors.filter((e) => e[0] === 1).length;

        if (errorCount > 0 || warningCount > 0) {
          console.log(
            `[LeekScript] Analysis complete for ${path.basename(
              document.fileName
            )}: ${errorCount} errors, ${warningCount} warnings`
          );
        }
      }
    } catch (error) {
      console.error(
        `[LeekScript] Analysis failed for ${path.basename(document.fileName)}:`,
        error
      );
    }
  }

  /**
   * Analyze document with debouncing
   */
  analyzeDocumentDebounced(document: vscode.TextDocument): void {
    const uri = document.uri.toString();

    // Clear existing timer for this document
    if (this.debounceTimers.has(uri)) {
      clearTimeout(this.debounceTimers.get(uri)!);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      await this.analyzeDocument(document);
      this.debounceTimers.delete(uri);
    }, DEBOUNCE_DELAY);

    this.debounceTimers.set(uri, timer);
  }

  /**
   * Clear debounce timer for a document
   */
  clearDebounceTimer(uri: string): void {
    if (this.debounceTimers.has(uri)) {
      clearTimeout(this.debounceTimers.get(uri)!);
      this.debounceTimers.delete(uri);
    }
  }

  /**
   * Clear all diagnostics
   */
  clearAll(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Dispose of the diagnostic collection
   */
  dispose(): void {
    // Clear all timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear and dispose diagnostic collection
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
  }
}
