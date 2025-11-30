import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getStringBeforeCursor } from "../../utils/UserCodeUtils";

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

    const wordBeforeDot = match[1];
    console.log("User typed dot after:", wordBeforeDot);

    const stringBeforeCursor = getStringBeforeCursor(document, position);
    console.log("String before cursor:", stringBeforeCursor);

    // const memberCompletions = this.getMemberCompletions(wordBeforeDot);
    const memberCompletions = this.getMemberCompletions(stringBeforeCursor);
    completionItems.push(...memberCompletions);

    return completionItems;
  }

  private getMemberCompletions(
    stringBeforeCursor: string
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];

    const dotSplit = stringBeforeCursor.split(".");
    console.log("Dot split:", dotSplit);

    const initialVariableName = dotSplit.shift() || "";
    console.log("Initial variable name:", initialVariableName);

    const initialUserVariable: UserVariable | null =
      this.definitionProvider.findUserDefinedVariable(initialVariableName);

    if (!initialUserVariable) {
      console.log(
        `No user-defined variable found for initial variable '${initialVariableName}', cannot provide member completions.`
      );
      return completionItems;
    }

    console.log(
      `Starting traversal from variable '${initialUserVariable.name}' of type '${initialUserVariable.type}'.`
    );

    while (dotSplit.length > 0) {
      const currentMemberName = dotSplit.shift() || "";
      console.log("Current member name to resolve:", currentMemberName);

      if (!currentMemberName) {
        console.log("No more members to resolve.");
        break;
      }

      const currentUserClass: UserClass | null =
        this.definitionProvider.findUserDefinedClass(initialUserVariable.type);

      if (!currentUserClass) {
        console.log(
          `No user-defined class found for type '${initialUserVariable.type}', cannot continue traversal.`
        );
        return completionItems;
      }

      const nextUserVariable = currentUserClass.fields.find(
        (field) => field.name === currentMemberName
      );

      if (!nextUserVariable) {
        console.log(
          `No member variable named '${currentMemberName}' found in class '${currentUserClass.name}', cannot continue traversal.`
        );
        return completionItems;
      }

      console.log(
        `Resolved member '${currentMemberName}' to variable of type '${nextUserVariable.type}'.`
      );

      // Update for next iteration
      initialUserVariable.type = nextUserVariable.type;
    }

    // Now provide completions for the final resolved type
    const finalUserClass: UserClass | null =
      this.definitionProvider.findUserDefinedClass(initialUserVariable.type);

    if (finalUserClass) {
      console.log(
        `Providing member completions for final class '${finalUserClass.name}'.`
      );
      // Methods
      for (const method of finalUserClass.methods) {
        const item = new vscode.CompletionItem(
          method.name,
          vscode.CompletionItemKind.Method
        );

        const params = method.arguments
          .map((arg, index) => `${arg.name}: ${method.arguments[index].type}`)
          .join(", ");
        item.detail = `${method.name}(${params}): ${
          method.returnType || "void"
        }`;
        item.documentation = new vscode.MarkdownString(
          `Method of class **${finalUserClass.name}**`
        );
        completionItems.push(item);
      }

      // Fields
      for (const field of finalUserClass.fields) {
        const item = new vscode.CompletionItem(
          field.name,
          vscode.CompletionItemKind.Field
        );
        item.detail = `var ${field.name}: ${field.type}`;
        item.documentation = new vscode.MarkdownString(
          `Field of class **${finalUserClass.name}**`
        );
        completionItems.push(item);
      }
    } else {
      console.log(
        `No user-defined class found for final type '${initialUserVariable.type}', cannot provide member completions.`
      );
    }

    return completionItems;
  }
}
