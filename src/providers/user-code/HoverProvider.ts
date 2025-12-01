import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getMarkdownGoToDefinitionCommand } from "../../utils/DefinitionUtils";
import { getMemberAccessStringAtCursor } from "../../utils/UserCodeUtils";

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
      return this.createMemberHover(memberParts);
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

    // TODO: handle include hover?

    return null;
  }

  createMemberHover(
    memberParts: string[]
  ): vscode.ProviderResult<vscode.Hover> {
    // example: user hovers "member2" in "obj.member1.member2.member3"
    // get first part
    let word = memberParts.shift() || "";

    console.log("Resolving member hover for word:", word);

    // Check if it's a user variable
    let userVariable = this.definitionProvider.findUserDefinedVariable(word);

    if (!userVariable) {
      console.log(
        `Cannot resolve member access for part '${word}', stopping traversal.`
      );
      return null;
    }

    // console.log("Traversing member parts of variable:", userVariable);

    while (memberParts.length > 0) {
      let word = memberParts.shift() || "";
      // console.log("LOOP: Resolving member definition for word:", word);

      const variableType = userVariable.type;

      // Check if the variable's type is a user-defined class
      const userClass =
        this.definitionProvider.findUserDefinedClass(variableType);

      if (!userClass) {
        console.log(
          `Type '${variableType}' of variable '${userVariable.name}' is not a user-defined class, cannot resolve member '${word}'.`
        );
        return null;
      }

      // console.log(
      //   `Looking for member '${word}' in class '${userClass.name}' members.`
      // );

      // Check if the member is a field
      const classField = userClass.fields.find((field) => field.name === word);
      if (classField) {
        // console.log(
        //   `Found field '${classField.name}' of class '${userClass.name}', continuing traversal.`
        // );
        userVariable = classField;

        if (memberParts.length === 0) {
          // Last part, return definition
          return this.createUserClassFieldHover(classField);
        }
        continue;
      }

      // Check if the member is a method
      const classMethod = userClass.methods.find(
        (method) => method.name === word
      );
      if (classMethod) {
        // console.log(
        //   `Found method '${classMethod.name}' of class '${userClass.name}', continuing traversal.`
        // );

        if (memberParts.length === 0) {
          // Last part, return definition
          return this.createUserClassMethodHover(classMethod);
        }
        // For methods, we cannot continue traversal, so we stop here
        return null;
      }

      console.log(
        `Member '${word}' not found in class '${userClass.name}', stopping traversal.`
      );
      return null;
    }

    return null;
  }

  createUserClassMethodHover(
    classMethod: UserFunction
  ): vscode.ProviderResult<vscode.Hover> {
    // Create markdown content
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

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
