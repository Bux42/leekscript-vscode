import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import { getStringBeforeCursor } from "../../utils/UserCodeUtils";
import {
  generateUserClassFieldCompletion,
  generateUserClassMethodCompletion,
} from "./CompletionGenerator";
import { resolveMemberClass } from "../../utils/ClassMemberUtils";
import { UserClass } from "../../services/analyzer/definitions.types";

/**
 * Provides code completion for dot member access in user code
 */
export class UserDotCodeCompletionProvider
  implements vscode.CompletionItemProvider
{
  private definitionProvider: DefinitionManager;

  constructor(definitionProvider: DefinitionManager) {
    this.definitionProvider = definitionProvider;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const completionItems: vscode.CompletionItem[] = [];

    // Get the line text up to the cursor
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    // Check if user just typed a dot after a word
    const match = linePrefix.match(/(\w+)\.$/);

    if (!match) {
      return undefined; // Don't provide completions
    }

    const memberAccessStringAtCursor = getStringBeforeCursor(
      document,
      position
    );

    const memberParts = memberAccessStringAtCursor
      .split(".")
      .filter((part) => part.length > 0);

    // Resolve the member access chain to get all related classes (including parent classes)
    const resolvedClasses: UserClass[] = resolveMemberClass(
      memberParts,
      this.definitionProvider
    );

    // Provide completions for all resolved classes (the target class and its parents)
    for (const userClass of resolvedClasses) {
      for (const field of userClass.fields) {
        completionItems.push(generateUserClassFieldCompletion(field));
      }
      for (const method of userClass.methods) {
        completionItems.push(generateUserClassMethodCompletion(method));
      }
    }

    return completionItems;
  }
}
