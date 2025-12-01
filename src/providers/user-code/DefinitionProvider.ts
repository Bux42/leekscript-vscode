import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getDefinitionAbsolutePath } from "../../utils/DefinitionUtils";
import { getMemberAccessStringAtCursor } from "../../utils/UserCodeUtils";

/**
 * Provides definition location for LeekScript symbols
 */
export class UserCodeDefinitionProvider implements vscode.DefinitionProvider {
  private definitionProvider: DefinitionManager;

  constructor(definitionProvider: DefinitionManager) {
    this.definitionProvider = definitionProvider;
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Definition | null {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    console.log(`Looking for definition of: ${word}`);

    const memberAccessStringAtCursor = getMemberAccessStringAtCursor(
      document,
      position
    );

    const memberParts = memberAccessStringAtCursor.split(".");

    if (memberParts.length > 1) {
      // member access detected
      return this.createMemberDefinition(memberParts);
    } else {
      // single word, not a member access

      // Check if it's a user function
      const userFunc = this.definitionProvider.findUserDefinedFunction(word);
      if (userFunc) {
        return this.createUserFunctionDefinition(userFunc);
      }

      // Check if it's a user class
      const userClass = this.definitionProvider.findUserDefinedClass(word);
      if (userClass) {
        return this.createUserClassDefinition(userClass);
      }

      // Check if it's a user variable
      const userVariable =
        this.definitionProvider.findUserDefinedVariable(word);
      if (userVariable) {
        return this.createUserVariableDefinition(userVariable);
      }
    }
    return null;
  }

  createMemberDefinition(memberParts: string[]): vscode.Definition | null {
    // example: user hit F12 on "member2" in "obj.member1.member2.member3"
    // get first part
    let word = memberParts.shift() || "";

    console.log("Resolving member definition for word:", word);

    // Check if it's a user variable
    let userVariable = this.definitionProvider.findUserDefinedVariable(word);

    if (!userVariable) {
      console.log(
        `Cannot resolve member access for part '${word}', stopping traversal.`
      );
      return null;
    }

    console.log("Traversing member parts of variable:", userVariable);

    while (memberParts.length > 0) {
      let word = memberParts.shift() || "";
      console.log("LOOP: Resolving member definition for word:", word);

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

      console.log(
        `Looking for member '${word}' in class '${userClass.name}' members.`
      );

      // Check if the member is a field
      const classField = userClass.fields.find((field) => field.name === word);
      if (classField) {
        console.log(
          `Found field '${classField.name}' of class '${userClass.name}', continuing traversal.`
        );
        userVariable = classField;

        if (memberParts.length === 0) {
          // Last part, return definition
          return this.createUserVariableDefinition(classField);
        }
        continue;
      }

      // Check if the member is a method
      const classMethod = userClass.methods.find(
        (method) => method.name === word
      );
      if (classMethod) {
        console.log(
          `Found method '${classMethod.name}' of class '${userClass.name}', continuing traversal.`
        );

        if (memberParts.length === 0) {
          // Last part, return definition
          return this.createUserFunctionDefinition(classMethod);
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

  createUserVariableDefinition(
    userVariable: UserVariable
  ): vscode.Definition | null {
    const position = new vscode.Position(
      userVariable.line - 1,
      userVariable.col
    );

    return new vscode.Location(
      vscode.Uri.file(
        getDefinitionAbsolutePath(
          userVariable.fileName,
          userVariable.folderName
        )!
      ),
      position
    );
  }

  createUserClassDefinition(userClass: UserClass): vscode.Definition | null {
    const position = new vscode.Position(userClass.line - 1, userClass.col);

    return new vscode.Location(
      vscode.Uri.file(
        getDefinitionAbsolutePath(userClass.fileName, userClass.folderName)!
      ),
      position
    );
  }

  createUserFunctionDefinition(
    userFunc: UserFunction
  ): vscode.Definition | null {
    const position = new vscode.Position(userFunc.line - 1, userFunc.col);

    return new vscode.Location(
      vscode.Uri.file(
        getDefinitionAbsolutePath(userFunc.fileName, userFunc.folderName)!
      ),
      position
    );
  }
}
