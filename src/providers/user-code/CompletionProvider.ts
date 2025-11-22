import * as vscode from "vscode";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { DefinitionManager } from "./DefinitionManager";

/**
 * Provides code completion for user definitions
 */
export class UserCodeCompletionProvider
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

    // check dot.
    // if word before dot is a known variable, of type class, provide class members
    const lineText = document.lineAt(position).text;
    const charIndex = position.character - 1;

    if (charIndex >= 0 && lineText.charAt(charIndex) === ".") {
      console.log(
        "Completion request triggered after a dot in UserCodeCompletionProvider, ignoring."
      );
      return [];
    }

    completionItems.push(...this.getUserFunctionCompletions());
    completionItems.push(...this.getUserClassCompletions());
    completionItems.push(...this.getUserVariableCompletions());

    return completionItems;
  }

  /**
   * Get user function completions
   * @returns Array of completion items for user functions
   */
  private getUserFunctionCompletions(): vscode.CompletionItem[] {
    return this.definitionProvider
      .getUserDefinedFunctions()
      .map((func: UserFunction) => {
        const item = new vscode.CompletionItem(
          func.name,
          vscode.CompletionItemKind.Function
        );

        // Build function signature
        const params = func.arguments
          .map((arg, index) => `${arg.name}: ${func.arguments[index].type}`)
          .join(", ");

        item.detail = `${func.name}(${params}): ${func.returnType || "void"}`;
        return item;
      });
  }

  /**
   *  Get user class completions
   * @returns Array of completion items for user classes
   */
  private getUserClassCompletions(): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];

    console.log(
      "User classes:",
      this.definitionProvider.getUserDefinedClasses().length
    );

    for (const userClass of this.definitionProvider.getUserDefinedClasses()) {
      const item = new vscode.CompletionItem(
        userClass.name,
        vscode.CompletionItemKind.Class
      );
      item.detail = `class ${userClass.name}`;
      item.documentation = new vscode.MarkdownString(
        `User-defined class **${userClass.name}**`
      );
      completionItems.push(item);
    }

    // // Check if user typed "ClassName."
    // if (linePrefix.endsWith("testInstance.")) {
    //   completionItems.push(
    //     createMethodCompletion("publicRealMethod", "real", "A property")
    //   );
    // }

    return completionItems;
  }

  /**
   * Get user variable completions
   * @returns  Array of completion items for user variables
   */
  private getUserVariableCompletions(): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];

    console.log(
      "User variables:",
      this.definitionProvider.getUserDefinedVariables().length
    );

    for (const userVariable of this.definitionProvider.getUserDefinedVariables()) {
      const item = new vscode.CompletionItem(
        userVariable.name,
        vscode.CompletionItemKind.Variable
      );
      item.detail = `var ${userVariable.name}: ${userVariable.type}`;
      item.documentation = new vscode.MarkdownString(
        `User-defined variable **${userVariable.name}** of type **${userVariable.type}**`
      );
      completionItems.push(item);
    }
    return completionItems;
  }
}
