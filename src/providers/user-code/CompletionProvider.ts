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

    const lineText = document.lineAt(position).text;
    const charIndex = position.character - 1;

    // check for class member access
    if (charIndex >= 0 && lineText.charAt(charIndex) === ".") {
      return this.getMemberCompletions(lineText, charIndex);
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

  /**
   * Get user member completions
   * @returns  Array of completion items for user variables
   */
  private getMemberCompletions(
    lineText: string,
    charIndex: number
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    // get word before dot
    const wordBeforeDot = lineText.substring(0, charIndex).split(/\W+/).pop();
    console.log("Word before dot:", wordBeforeDot);

    if (wordBeforeDot === "this") {
      console.log("Member access on 'this' is not supported yet.");
    }

    const userVariable: UserVariable | null =
      this.definitionProvider.findUserDefinedVariable(wordBeforeDot || "");

    if (userVariable) {
      console.log(
        `Providing member completions for variable: ${userVariable.name}`
      );
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
