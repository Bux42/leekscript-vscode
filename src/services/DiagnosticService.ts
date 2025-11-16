import * as vscode from "vscode";
import * as path from "path";
import { CodeAnalyzerService, AnalysisError } from "../services/analyzer";
import { DataLoader } from "../utils/DataLoader";

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
  private fileToAIIdMap = new Map<string, number>();

  constructor(
    diagnosticCollection: vscode.DiagnosticCollection,
    analyzerService: CodeAnalyzerService,
    dataLoader: DataLoader
  ) {
    this.diagnosticCollection = diagnosticCollection;
    this.analyzerService = analyzerService;
    this.dataLoader = dataLoader;
  }

  /**
   * Get or create an AI ID for a given file path
   */
  private async getOrCreateAIId(filePath: string): Promise<number | null> {
    // Check if we already have an AI ID for this file
    if (this.fileToAIIdMap.has(filePath)) {
      return this.fileToAIIdMap.get(filePath)!;
    }

    // Create a new AI file with the same name
    const fileName = path.basename(filePath);
    const ai = await this.analyzerService.createAI(0, fileName);

    if (ai) {
      this.fileToAIIdMap.set(filePath, ai.id);
      console.log(`[LeekScript] Mapped ${fileName} to AI ID ${ai.id}`);
      return ai.id;
    }

    return null;
  }

  /**
   * Format error message by replacing {0}, {1}, etc. with parameters
   */
  private formatErrorMessage(template: string, params: string[]): string {
    let message = template;
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

    const code = document.getText();
    const name = path.basename(document.fileName);

    // If analyzer service is not available or server is not running, skip analysis
    if (!this.analyzerService.getServerStatus()) {
      return;
    }

    try {
      // Get or create AI ID for this file
      const aiId = await this.getOrCreateAIId(document.fileName);

      if (!aiId) {
        console.error(`[LeekScript] Failed to get AI ID for ${name}`);
        return;
      }

      // Send code to analyzer and get results
      const result = await this.analyzerService.saveAI(aiId, code);

      if (result) {
        const errors = result.result[aiId.toString()] || [];
        const diagnostics = this.convertAnalysisErrorsToDiagnostics(errors);

        // Update diagnostics for this document
        this.diagnosticCollection.set(document.uri, diagnostics);

        const errorCount = errors.filter((e) => e[0] === 0).length;
        const warningCount = errors.filter((e) => e[0] === 1).length;

        if (errorCount > 0 || warningCount > 0) {
          console.log(
            `[LeekScript] Analysis complete for ${name}: ${errorCount} errors, ${warningCount} warnings`
          );
        }
      }
    } catch (error) {
      console.error(`[LeekScript] Analysis failed for ${name}:`, error);
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
