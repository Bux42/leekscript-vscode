import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserVariable,
} from "../../services/analyzer/definitions.types";

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

    const memberCompletions = this.getMemberCompletions(wordBeforeDot);
    completionItems.push(...memberCompletions);

    return completionItems;
  }

  private getMemberCompletions(wordBeforeDot: string): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];

    const userVariable: UserVariable | null =
      this.definitionProvider.findUserDefinedVariable(wordBeforeDot || "");

    if (userVariable) {
      console.log(userVariable);

      const userVariableType = userVariable.type;

      const userClass: UserClass | null =
        this.definitionProvider.findUserDefinedClass(userVariableType);

      if (userClass) {
        console.log(
          `Found class ${userClass.name} for variable ${userVariable.name}, providing member completions for ${userClass.methods.length} methods.`
        );
        // Provide class member completions (methods and fields)
        // Methods
        for (const method of userClass.methods) {
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
            `Method of class **${userClass.name}**`
          );
          completionItems.push(item);
        }

        // Fields
        for (const field of userClass.fields) {
          // if (field.level !== "public") {
          //   console.log(
          //     `Skipping non-public field: ${field.name} (level: ${field.level})`
          //   );
          //   continue; // skip non-public fields
          // }
          const item = new vscode.CompletionItem(
            field.name,
            vscode.CompletionItemKind.Field
          );
          item.detail = `var ${field.name}: ${field.type}`;
          item.documentation = new vscode.MarkdownString(
            `Field of class **${userClass.name}**`
          );
          completionItems.push(item);
        }
      }
    }

    return completionItems;
  }
}
