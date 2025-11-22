import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";

/**
 * Provides semantic tokens for user-defined classes
 * This enables proper syntax highlighting for custom types
 */
export class UserCodeSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  private definitionManager: DefinitionManager;
  private _onDidChangeSemanticTokens = new vscode.EventEmitter<void>();
  public readonly onDidChangeSemanticTokens =
    this._onDidChangeSemanticTokens.event;

  constructor(definitionManager: DefinitionManager) {
    this.definitionManager = definitionManager;
  }

  /**
   * Trigger a refresh of semantic tokens
   */
  public refresh(): void {
    this._onDidChangeSemanticTokens.fire();
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
    const text = document.getText();
    const userClasses = this.definitionManager.getUserDefinedClasses();

    if (userClasses.length === 0) {
      return tokensBuilder.build();
    }

    // Create a regex pattern that matches all class names
    const classNames = userClasses.map((cls) => cls.name);
    const pattern = new RegExp(`\\b(${classNames.join("|")})\\b`, "g");

    const lines = text.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match: RegExpExecArray | null;

      // Reset regex state
      pattern.lastIndex = 0;

      while ((match = pattern.exec(line)) !== null) {
        const startChar = match.index;
        const length = match[0].length;

        // Add semantic token for class
        tokensBuilder.push(
          new vscode.Range(
            new vscode.Position(lineIndex, startChar),
            new vscode.Position(lineIndex, startChar + length)
          ),
          "class",
          ["declaration"]
        );
      }
    }

    return tokensBuilder.build();
  }
}

/**
 * Legend defining semantic token types and modifiers
 */
export const legend = new vscode.SemanticTokensLegend(
  ["class"],
  ["declaration"]
);
