import * as vscode from "vscode";
import * as path from "path";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import {
  getDefinitionAbsolutePath,
  getMarkdownGoToDefinitionCommand,
} from "../../utils/DefinitionUtils";

export class UserCodeHoverProvider implements vscode.HoverProvider {
  private definitionProvider: DefinitionManager;

  constructor(definitionProvider: DefinitionManager) {
    this.definitionProvider = definitionProvider;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    console.log(`Hover requested for user code symbol: ${word}`);

    // Check if it's a user function
    const userFunc = this.definitionProvider.findUserDefinedFunction(word);
    if (userFunc) {
      return this.createUserFunctionHover(userFunc);
    }

    // Check if it's a user class
    const userClass = this.definitionProvider.findUserDefinedClass(word);
    if (userClass) {
      return this.createUserClassHover(userClass);
    }

    // Check if it's a user variable
    const userVariable = this.definitionProvider.findUserDefinedVariable(word);
    if (userVariable) {
      return this.createUserVariableHover(userVariable);
    }

    // TODO: handle include hover?

    return null;
  }

  createUserVariableHover(
    userVariable: UserVariable
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    console.log(`Creating hover for user variable: ${userVariable.name}`);
    const variableDeclaration = `var ${userVariable.name}: ${userVariable.type}`;

    markdown.appendCodeblock(variableDeclaration, "leekscript");

    markdown.appendMarkdown(
      getMarkdownGoToDefinitionCommand(
        userVariable.fileName,
        userVariable.folderName,
        userVariable.line,
        userVariable.col
      )
    );
    return new vscode.Hover(markdown);
  }

  createUserClassHover(
    userClass: UserClass
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    console.log(`Creating hover for user class: ${userClass.name}`);
    let classDeclaration = `class ${userClass.name}`;

    // TODO: handle multiple constructors
    if (userClass.constructors.length > 0) {
      const constructor = userClass.constructors[0];
      const params = constructor.arguments
        .map((arg) => {
          const isOptional = arg.optional;
          const optionalMark = isOptional ? "?" : "";
          return `${arg.name}${optionalMark}: ${arg.type}`;
        })
        .join(", ");
      const constructorSignature = `constructor(${params})`;
      classDeclaration += ` ${constructorSignature}`;
    }

    markdown.appendCodeblock(classDeclaration, "leekscript");

    markdown.appendMarkdown(
      getMarkdownGoToDefinitionCommand(
        userClass.fileName,
        userClass.folderName,
        userClass.line,
        userClass.col
      )
    );

    return new vscode.Hover(markdown);
  }

  createUserFunctionHover(
    userFunc: UserFunction
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    // Build function signature
    const params = userFunc.arguments
      .map((arg, index) => {
        const isOptional = arg.optional;
        const optionalMark = isOptional ? "?" : "";
        return `${arg.name}${optionalMark}: ${arg.type}`;
      })
      .join(", ");

    const signature = `function ${userFunc.name}(${params}): ${userFunc.returnType}`;

    markdown.appendCodeblock(signature, "leekscript");

    markdown.appendMarkdown(
      getMarkdownGoToDefinitionCommand(
        userFunc.fileName,
        userFunc.folderName,
        userFunc.line,
        userFunc.col
      )
    );

    return new vscode.Hover(markdown);
  }
}
