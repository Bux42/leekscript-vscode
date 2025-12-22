import * as vscode from "vscode";
import * as path from "path";
import { CodeAnalyzerService, AnalysisError } from "../services/analyzer";
import { DataLoader } from "../providers/leekscript/DataLoader";
import { DefinitionManager } from "../providers/user-code/DefinitionManager";
import { UserCodeSemanticTokensProvider } from "../providers/user-code/SemanticTokensProvider";
import { JavaStringHash } from "../utils/JavaStringHash";

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
  private userCodeDefinitionManager: DefinitionManager;
  private semanticTokensProvider: UserCodeSemanticTokensProvider | null = null;

  constructor(
    diagnosticCollection: vscode.DiagnosticCollection,
    analyzerService: CodeAnalyzerService,
    dataLoader: DataLoader,
    userCodeDefinitionManager: DefinitionManager
  ) {
    this.diagnosticCollection = diagnosticCollection;
    this.analyzerService = analyzerService;
    this.dataLoader = dataLoader;
    this.userCodeDefinitionManager = userCodeDefinitionManager;
  }

  /**
   * Set the semantic tokens provider for refreshing
   */
  public setSemanticTokensProvider(
    provider: UserCodeSemanticTokensProvider
  ): void {
    this.semanticTokensProvider = provider;
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
   * Find all .leek files in the workspace and compute their hash codes
   * @returns A dictionary mapping hash ID to file URI
   */
  async getAllLeekFilesWithHashes(): Promise<Record<number, vscode.Uri>> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.error("[LeekScript] No workspace folder found");
      return {};
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const hashToUri: Record<number, vscode.Uri> = {};

    // Find all .leek files in the workspace
    const leekFiles = await vscode.workspace.findFiles("**/*.leek");

    for (const fileUri of leekFiles) {
      try {
        // Get relative path from workspace
        let relativePath = path.relative(workspaceRoot, fileUri.fsPath);

        // Create the hash path with backslashes (to match the format used in analyzeDocument)
        const hashCodePath = `user-code\\${relativePath}`;

        // Compute hash
        const hash = new JavaStringHash(hashCodePath).hashCode();

        // Store in dictionary
        hashToUri[hash] = fileUri;

        // console.log(`[LeekScript] Hashed file: ${relativePath} -> ${hash}`);
      } catch (error) {
        console.error(
          `[LeekScript] Failed to process file ${fileUri.fsPath}:`,
          error
        );
      }
    }

    return hashToUri;
  }

  /**
   * Get definitions for user code and update definition manager
   */
  async getUserCodeDefinitions() {
    // Get relative path from workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.error("[LeekScript] No workspace folder found");
      return;
    }

    const document = vscode.window.activeTextEditor?.document;
    if (!document) {
      console.error("[LeekScript] No active document found");
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    let relativePath = path.relative(workspaceRoot, document.fileName);

    // Normalize path separators to forward slashes
    relativePath = relativePath.replace(/\\/g, "/");

    // Prepend "user-code/"
    const filePath = `user-code/${relativePath}`;

    try {
      const currentDocumentCode = document.getText();

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        console.log("line" + activeEditor.selection.active.line);
        console.log("column" + activeEditor.selection.active.character);

        const userCodeDefinitions = await this.analyzerService.getDefinitions(
          activeEditor.selection.active.line + 1,
          activeEditor.selection.active.character + 1,
          filePath,
          currentDocumentCode
        );
        console.log(userCodeDefinitions);

        if (userCodeDefinitions) {
          this.userCodeDefinitionManager.setUserDefinedClasses(
            userCodeDefinitions.classes
          );
          this.userCodeDefinitionManager.setUserDefinedFunctions(
            userCodeDefinitions.functions
          );
          this.userCodeDefinitionManager.setUserDefinedVariables(
            userCodeDefinitions.variables
          );

          // Refresh semantic tokens to update highlighting
          if (this.semanticTokensProvider) {
            this.semanticTokensProvider.refresh();
          }
        }
      }
    } catch (error) {
      console.error(
        `[LeekScript] User definition retrieval failed for ${path.basename(
          document.fileName
        )}:`,
        error
      );
    }
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

    // Get relative path from workspace
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    let relativePath = path.relative(workspaceRoot, document.fileName);

    // Normalize path separators to forward slashes
    const normalizedRelativePath = relativePath.replace(/\\/g, "/");

    // Prepend "user-code/"
    const filePath = `user-code/${normalizedRelativePath}`;

    // Analyze file with new endpoint (file must be saved on disk)
    try {
      const result = await this.analyzerService.analyzeFile(filePath);

      if (result) {
        // Get all leek files with their hashes for mapping errors to files
        const hashToUri = await this.getAllLeekFilesWithHashes();

        // Group errors by AI ID (hash)
        const errorsByAiId = new Map<number, AnalysisError[]>();

        for (const error of result.errors) {
          const aiId = error[1]; // Second element is the AI file ID (hash)

          if (!errorsByAiId.has(aiId)) {
            errorsByAiId.set(aiId, []);
          }
          errorsByAiId.get(aiId)!.push(error);
        }

        // Clear all previous diagnostics before setting new ones
        this.diagnosticCollection.clear();

        // Convert and set diagnostics for each file
        let totalErrors = 0;
        let totalWarnings = 0;

        for (const [aiId, errors] of errorsByAiId) {
          const fileUri = hashToUri[aiId];

          if (!fileUri) {
            console.warn(
              `[LeekScript] No file found for AI ID (hash): ${aiId}`
            );
            continue;
          }

          const diagnostics = this.convertAnalysisErrorsToDiagnostics(errors);
          this.diagnosticCollection.set(fileUri, diagnostics);

          const errorCount = errors.filter((e) => e[0] === 0).length;
          const warningCount = errors.filter((e) => e[0] === 1).length;

          totalErrors += errorCount;
          totalWarnings += warningCount;

          if (errorCount > 0 || warningCount > 0) {
            console.log(
              `[LeekScript] ${path.basename(
                fileUri.fsPath
              )}: ${errorCount} errors, ${warningCount} warnings`
            );
          }
        }

        console.log(
          `[LeekScript] Analysis complete: ${totalErrors} errors, ${totalWarnings} warnings across ${errorsByAiId.size} files`
        );
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
