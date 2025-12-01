import * as vscode from "vscode";
import {
  UserClass,
  UserFunction,
} from "../../services/analyzer/definitions.types";
import { DefinitionManager } from "./DefinitionManager";
import { getStringBeforeCursor } from "../../utils/UserCodeUtils";
import {
  generateUserClassFieldCompletion,
  generateUserClassMethodCompletion,
} from "./CompletionGenerator";

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

    const memberAccessStringAtCursor = getStringBeforeCursor(
      document,
      position
    );

    const memberParts = memberAccessStringAtCursor.split(".");

    console.log("Providing user code completions, memberParts: ", memberParts);

    if (memberParts.length > 1) {
      //  Member access, e.g., objectA.member1.member2
      return this.getCompletionsForMemberAccess(memberParts);
    }

    completionItems.push(...this.getUserFunctionCompletions());
    completionItems.push(...this.getUserClassCompletions());
    completionItems.push(...this.getUserVariableCompletions());

    return completionItems;
  }

  /**
   * Get completions for member access (e.g., object.member)
   * @param memberParts Parts of the member access string
   * @returns Array of completion items for the member access
   */
  private getCompletionsForMemberAccess(
    memberParts: string[]
  ): vscode.CompletionItem[] {
    // example: user hovers "member2" in "obj.member1.member2.member3"
    // get first part
    let word = memberParts.shift() || "";

    console.log("Resolving member completions for word:", word);

    // Check if it's a user variable
    let userVariable = this.definitionProvider.findUserDefinedVariable(word);

    if (!userVariable) {
      console.log(
        `Cannot resolve member access for part '${word}', stopping traversal.`
      );
      return [];
    }

    // console.log("Traversing member parts of variable:", userVariable);
    let userClass: UserClass | null =
      this.definitionProvider.findUserDefinedClass(userVariable.type);

    if (!userClass) {
      console.log(
        `Type '${userVariable.type}' of variable '${userVariable.name}' is not a user-defined class, stopping traversal.`
      );
      return [];
    }

    while (memberParts.length > 1) {
      let word = memberParts.shift() || "";
      console.log("LOOP: Resolving member definition for word:", word);

      // check class members (fields & methods)
      const classField = userClass.fields.find((field) => field.name === word);

      if (!classField) {
        console.log(
          `Member '${word}' not found in class '${userClass.name}', stopping traversal.`
        );
        return [];
      } else {
        // Found field, get its type
        const fieldType = classField.type;
        userClass = this.definitionProvider.findUserDefinedClass(fieldType);
        if (!userClass) {
          console.log(
            `Type '${fieldType}' of field '${classField.name}' is not a user-defined class, stopping traversal.`
          );
          return [];
        }
      }
    }

    const lastWord = memberParts.shift() || "";
    console.log("Getting completions for last member part:", lastWord);

    if (userClass) {
      const completionItems: vscode.CompletionItem[] = [];

      console.log(
        `Looking for members of class '${userClass.name}' for completions.`
      );

      for (const field of userClass.fields) {
        completionItems.push(generateUserClassFieldCompletion(field));
      }
      for (const method of userClass.methods) {
        completionItems.push(generateUserClassMethodCompletion(method));
      }
      return completionItems;
    }
    return [];
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
}
