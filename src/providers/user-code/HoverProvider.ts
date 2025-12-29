import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getMarkdownGoToDefinitionCommand } from "../../utils/DefinitionUtils";
import { getMemberAccessStringAtCursor } from "../../utils/UserCodeUtils";
import { tryAppendDocumentationToMarkdown } from "./DocumentationGenerator";
import { ResolvedMember, resolveMembers } from "../../utils/ClassMemberUtils";

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

    const memberAccessStringAtCursor = getMemberAccessStringAtCursor(
      document,
      position
    );

    const memberParts = memberAccessStringAtCursor.split(".");

    console.log(
      `Hover requested for user code symbol: ${word}, memberAccessStringAtCursor: ${memberAccessStringAtCursor}`
    );

    if (memberParts.length > 1) {
      // member access detected
      const resolvedMember: ResolvedMember | null = resolveMembers(
        memberParts,
        this.definitionProvider
      );

      if (resolvedMember) {
        if (resolvedMember.field) {
          return this.createUserVariableHover(resolvedMember.field);
        }
        if (resolvedMember.method) {
          return this.createUserFunctionHover(resolvedMember.method);
        }
      }
    }

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

    // Check if "this" is present in the user defined variables
    // If nothing was found yet, we can check if the user is hovering over a member of a class from inside that class
    const thisVariable =
      this.definitionProvider.findUserDefinedVariable("this");

    if (thisVariable) {
      // Check if the type of "this" is a user-defined class
      const thisClass = this.definitionProvider.findUserDefinedClass(
        thisVariable.type
      );

      if (thisClass) {
        // check if the word is a member of this class
        const classField = thisClass.fields.find(
          (field) => field.name === word
        );
        if (classField) {
          return this.createUserClassFieldHover(classField);
        }
        const classMethod = thisClass.methods.find(
          (method) => method.name === word
        );
        if (classMethod) {
          return this.createUserClassMethodHover(classMethod);
        }
      }
    }

    // TODO: handle include hover?

    return null;
  }

  createUserClassMethodHover(
    classMethod: UserFunction
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    tryAppendDocumentationToMarkdown(classMethod, markdown);

    console.log(`Creating hover for class method: ${classMethod.name}`);
    // Build method signature
    const params = classMethod.arguments
      .map((arg, index) => {
        const isOptional = arg.optional;
        const optionalMark = isOptional ? "?" : "";
        return `${arg.name}${optionalMark}: ${arg.type}`;
      })
      .join(", ");

    const methodSignature = `${classMethod.name}(${params}): ${classMethod.returnType}`;
    markdown.appendCodeblock(methodSignature, "leekscript");

    markdown.appendMarkdown(
      getMarkdownGoToDefinitionCommand(
        classMethod.fileName,
        classMethod.folderName,
        classMethod.line,
        classMethod.col
      )
    );
    return new vscode.Hover(markdown);
  }

  createUserClassFieldHover(
    classField: UserVariable
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    tryAppendDocumentationToMarkdown(classField, markdown);

    console.log(`Creating hover for class field: ${classField.name}`);
    const fieldDeclaration = `var ${classField.name}: ${classField.type}`;

    markdown.appendCodeblock(fieldDeclaration, "leekscript");

    markdown.appendMarkdown(
      getMarkdownGoToDefinitionCommand(
        classField.fileName,
        classField.folderName,
        classField.line,
        classField.col
      )
    );
    return new vscode.Hover(markdown);
  }

  createUserVariableHover(
    userVariable: UserVariable
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    tryAppendDocumentationToMarkdown(userVariable, markdown);

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

    tryAppendDocumentationToMarkdown(userClass, markdown);

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

    tryAppendDocumentationToMarkdown(userFunc, markdown);

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
