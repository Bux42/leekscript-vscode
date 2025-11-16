import * as vscode from "vscode";
import { DataLoader, FunctionData, ConstantData } from "../utils/DataLoader";

/**
 * Provides hover information for LeekScript symbols
 */
export class LeekScriptHoverProvider implements vscode.HoverProvider {
  private dataLoader: DataLoader;

  constructor(dataLoader: DataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * Provide hover information
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    // TODO: Check user-defined symbols first

    // Check if it's a built-in function
    const func = this.dataLoader.findFunction(word);
    if (func) {
      return this.createFunctionHover(func);
    }

    // Check if it's a constant
    const constant = this.dataLoader.findConstant(word);
    if (constant) {
      return this.createConstantHover(constant);
    }

    return null;
  }

  /**
   * Create hover information for a function
   */
  private createFunctionHover(func: FunctionData): vscode.Hover {
    const docData = this.dataLoader.getDocData();

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
    const signature = `${func.name}(${params}): ${returnType} (${returnName})`;

    // Get documentation
    const docKey = `func_${func.name}`;
    let documentation = docData[docKey] || "No documentation available";

    // Add link to encyclopedia
    const encyclopediaUrl = `https://leekwars.com/encyclopedia/en/${func.name}`;
    documentation += ` [🔗](${encyclopediaUrl} "View in LeekWars Encyclopedia")`;

    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.appendCodeblock(signature, "leekscript");
    markdown.appendMarkdown("\n" + documentation);

    // Add argument descriptions
    const argDescriptions = this.getArgumentDescriptions(func, docData);
    if (argDescriptions.length > 0) {
      markdown.appendMarkdown("\n\n**Parameters:**\n");
      markdown.appendMarkdown(argDescriptions.join("\n"));
    }

    // Add return value description
    const returnDocKey = `func_${func.name}_return`;
    const returnDoc = docData[returnDocKey];
    if (returnDoc) {
      markdown.appendMarkdown("\n\n**Returns:**\n");
      markdown.appendMarkdown(`${returnDoc}`);
    }

    // Add operations cost
    if (func.operations !== undefined && func.operations !== null) {
      markdown.appendMarkdown("\n\n**Operations:** ");
      if (func.operations === -1) {
        markdown.appendMarkdown("Variable");
      } else {
        markdown.appendMarkdown(`${func.operations}`);
      }
    }

    return new vscode.Hover(markdown);
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
   * Create hover information for a constant
   */
  private createConstantHover(constant: ConstantData): vscode.Hover {
    const docData = this.dataLoader.getDocData();

    // Get documentation
    const docKey = `const_${constant.name}`;
    const documentation = docData[docKey] || "No documentation available";

    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.appendCodeblock(
      `const ${constant.name} = ${constant.value}`,
      "leekscript"
    );
    markdown.appendMarkdown("\n" + documentation);

    return new vscode.Hover(markdown);
  }
}
