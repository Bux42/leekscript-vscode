/**
 * Error handling utilities for the Code Analyzer Service
 */
import * as vscode from "vscode";
import { HttpError } from "../services/analyzer/types";

export class ErrorHandler {
  /**
   * Handle Code Analyzer errors and display user-friendly messages
   * @param context Descriptive message about the operation that failed
   * @param error Error object from HTTP request
   */
  static handleCodeAnalyzerError(context: string, error: any): void {
    console.error(`[CodeAnalyzer] ${context}:`, error);

    // Check if it's our custom error object from HttpClient
    if (error && typeof error === "object") {
      if (error.code === "ECONNREFUSED") {
        vscode.window.showErrorMessage(
          `${context}: Code Analysis Server is not running. Please start the server.`
        );
      } else if (error.code === "ETIMEDOUT") {
        vscode.window.showErrorMessage(
          `${context}: Request timeout. Server may be unresponsive.`
        );
      } else if (error.statusCode) {
        const statusCode = error.statusCode;
        const errorData = error.message;

        if (statusCode === 404) {
          vscode.window.showErrorMessage(
            `${context}: Resource not found - ${errorData}`
          );
        } else if (statusCode === 405) {
          vscode.window.showErrorMessage(`${context}: Invalid HTTP method`);
        } else {
          vscode.window.showErrorMessage(
            `${context}: ${errorData || "Unknown error"}`
          );
        }
      } else if (error.message) {
        vscode.window.showErrorMessage(`${context}: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`${context}: Unknown error`);
      }
    } else {
      vscode.window.showErrorMessage(
        `${context}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Log an info message
   */
  static logInfo(message: string): void {
    console.log(`[CodeAnalyzer] ${message}`);
  }

  /**
   * Log an error message
   */
  static logError(message: string, error?: any): void {
    if (error) {
      console.error(`[CodeAnalyzer] ${message}:`, error);
    } else {
      console.error(`[CodeAnalyzer] ${message}`);
    }
  }
}
