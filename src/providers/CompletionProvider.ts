import * as vscode from "vscode";
import { DataLoader, FunctionData, ConstantData } from "../utils/DataLoader";

/**
 * Provides code completion for LeekScript language
 */
export class LeekScriptCompletionProvider
  implements vscode.CompletionItemProvider
{
  private dataLoader: DataLoader;

  constructor(dataLoader: DataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * Provide completion items
   */
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];

    // Add function completions
    completionItems.push(...this.getFunctionCompletions());

    // Add constant completions
    completionItems.push(...this.getConstantCompletions());

    // Add keyword completions
    completionItems.push(...this.getKeywordCompletions());

    // Add type keyword completions
    completionItems.push(...this.getTypeKeywordCompletions());

    return completionItems;
  }

  /**
   * Generate function completion items
   */
  private getFunctionCompletions(): vscode.CompletionItem[] {
    const functions = this.dataLoader.getFunctions();
    const docData = this.dataLoader.getDocData();

    return functions.map((func: FunctionData) => {
      const item = new vscode.CompletionItem(
        func.name,
        vscode.CompletionItemKind.Function
      );

      // Build function signature
      const params = func.arguments_names
        .map((name: string, index: number) => {
          const type = DataLoader.getTypeName(func.arguments_types[index]);
          const isOptional = func.optional && func.optional[index] === true;
          const optionalMark = isOptional ? "?" : "";
          return `${name}${optionalMark}: ${type}`;
        })
        .join(", ");

      const returnType = DataLoader.getTypeName(func.return_type.toString());
      const returnName = func.return_name || "result";
      item.detail = `${func.name}(${params}): ${returnType} ${returnName}`;

      // Build documentation
      item.documentation = this.buildFunctionDocumentation(func, docData);

      // Set insert text with parameter snippets
      const paramSnippets = func.arguments_names
        .map((name: string, index: number) => `\${${index + 1}:${name}}`)
        .join(", ");
      item.insertText = new vscode.SnippetString(
        `${func.name}(${paramSnippets})`
      );

      return item;
    });
  }

  /**
   * Build documentation markdown for a function
   */
  private buildFunctionDocumentation(
    func: FunctionData,
    docData: { [key: string]: string }
  ): vscode.MarkdownString {
    const docKey = `func_${func.name}`;
    let documentation = docData[docKey] || "No documentation available";

    // Add link to encyclopedia
    const encyclopediaUrl = `https://leekwars.com/encyclopedia/en/${func.name}`;
    documentation += ` [🔗](${encyclopediaUrl} "View in LeekWars Encyclopedia")`;

    const docMarkdown = new vscode.MarkdownString(documentation);
    docMarkdown.supportHtml = true;

    // Add argument descriptions
    const argDescriptions = this.getArgumentDescriptions(func, docData);
    if (argDescriptions.length > 0) {
      docMarkdown.appendMarkdown("\n\n**Parameters:**\n");
      docMarkdown.appendMarkdown(argDescriptions.join("\n"));
    }

    // Add return value description
    const returnDocKey = `func_${func.name}_return`;
    const returnDoc = docData[returnDocKey];
    if (returnDoc) {
      docMarkdown.appendMarkdown("\n\n**Return:**\n");
      docMarkdown.appendMarkdown(`${returnDoc}`);
    }

    // Add operations cost
    if (func.operations !== undefined && func.operations !== null) {
      docMarkdown.appendMarkdown("\n\n");
      if (func.operations === -1) {
        docMarkdown.appendMarkdown("Complexity **O(n²)**");
      } else {
        docMarkdown.appendMarkdown(`**${func.operations} operations**`);
      }
    }

    return docMarkdown;
  }

  /**
   * Get argument descriptions for a function
   */
  private getArgumentDescriptions(
    func: FunctionData,
    docData: { [key: string]: string }
  ): string[] {
    const argDescriptions: string[] = [];

    func.arguments_names.forEach((argName: string, index: number) => {
      const argDocKey = `func_${func.name}_arg_${index + 1}`;
      const argDoc = docData[argDocKey];
      if (argDoc) {
        const argType = DataLoader.getTypeName(func.arguments_types[index]);
        argDescriptions.push(`- **${argName}** (${argType}): ${argDoc}`);
      }
    });

    return argDescriptions;
  }

  /**
   * Generate constant completion items
   */
  private getConstantCompletions(): vscode.CompletionItem[] {
    const constants = this.dataLoader.getConstants();
    const docData = this.dataLoader.getDocData();

    return constants.map((constant: ConstantData) => {
      const item = new vscode.CompletionItem(
        constant.name,
        vscode.CompletionItemKind.Constant
      );

      item.detail = `${constant.name} = ${constant.value}`;

      // Get documentation
      const docKey = `const_${constant.name}`;
      const documentation = docData[docKey] || "No documentation available";

      const docMarkdown = new vscode.MarkdownString(documentation);
      docMarkdown.supportHtml = true;
      item.documentation = docMarkdown;

      return item;
    });
  }

  /**
   * Generate keyword completion items
   */
  private getKeywordCompletions(): vscode.CompletionItem[] {
    const keywords = [
      "break",
      "class",
      "continue",
      "constructor",
      "do",
      "else",
      "extends",
      "for",
      "function",
      "if",
      "in",
      "new",
      "return",
      "super",
      "this",
      "var",
      "void",
      "while",
      "private",
      "public",
      "protected",
      "static",
      "not",
      "global",
      "and",
      "or",
      "xor",
      "instanceof",
      "as",
      "final",
    ];

    return keywords.map((keyword) => {
      return new vscode.CompletionItem(
        keyword,
        vscode.CompletionItemKind.Keyword
      );
    });
  }

  /**
   * Generate type keyword completion items
   */
  private getTypeKeywordCompletions(): vscode.CompletionItem[] {
    const typeKeywords = [
      "any",
      "boolean",
      "number",
      "object",
      "string",
      "undefined",
      "integer",
      "real",
    ];

    return typeKeywords.map((typeKeyword) => {
      return new vscode.CompletionItem(
        typeKeyword,
        vscode.CompletionItemKind.TypeParameter
      );
    });
  }
}

/**
 * Provides member completion for LeekScript (triggered by ".")
 */
export class LeekScriptMemberCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    // TODO: Implement member completion logic
    // This would require type inference or semantic analysis
    return [];
  }
}
