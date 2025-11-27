import * as vscode from "vscode";
import { DataLoader } from "../leekscript/DataLoader";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getDefinitionAbsolutePath } from "../../utils/DefinitionUtils";

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
    // check if cursor is after a dot (.)
    const lineText = document.lineAt(position).text;
    const charIndex = position.character - 1;

    console.log("lineText:", lineText, "charIndex:", charIndex);

    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    console.log(`Looking for definition of: ${word}`);

    // check if character before word is a dot (.)
    if (range) {
      const tokenBeforeWord = lineText.charAt(range!.start.character - 1);
      console.log("tokenBeforeWord:", tokenBeforeWord);

      if (tokenBeforeWord === ".") {
        // get word before the dot
        const wordBeforeDotRange = document.getWordRangeAtPosition(
          new vscode.Position(position.line, range!.start.character - 2)
        );
        const tokenBeforeDot = document.getText(wordBeforeDotRange);

        console.log(
          "Definition request triggered after a dot",
          "tokenBeforeDot:",
          tokenBeforeDot
        );
        return this.createMemberDefinition(
          range,
          document.getText(range),
          lineText,
          tokenBeforeDot
        );
      }
    }

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
    const userVariable = this.definitionProvider.findUserDefinedVariable(word);
    if (userVariable) {
      return this.createUserVariableDefinition(userVariable);
    }
    return null;
  }

  createMemberDefinition(
    range: vscode.Range,
    word: string,
    lineText: string,
    tokenBeforeWord: string
  ): vscode.Definition | null {
    // get token before the dot

    console.log("searching for member definition of word:", tokenBeforeWord);
    const userVariable: UserVariable | null =
      this.definitionProvider.findUserDefinedVariable(tokenBeforeWord || "");

    if (userVariable) {
      console.log(
        `Providing member definition for variable: ${userVariable.name} of type: ${userVariable.type}`
      );

      // Check if the variable's type is a user-defined class
      const userClass = this.definitionProvider.findUserDefinedClass(
        userVariable.type
      );

      if (userClass) {
        console.log(
          `Search member definition for class: ${userClass.name} members`
        );
        // Check if the member is a field
        const classField = userClass.fields.find(
          (field) => field.name === word
        );
        if (classField) {
          console.log(
            `Found member definition for field: ${classField.name} of class: ${userClass.name}`
          );
          const position = new vscode.Position(
            classField.line - 1,
            classField.col
          );

          return new vscode.Location(
            vscode.Uri.file(
              getDefinitionAbsolutePath(
                classField.fileName,
                classField.folderName
              )!
            ),
            position
          );
        }

        // Check if the member is a method
        const classMethod = userClass.methods.find(
          (method) => method.name === word
        );
        if (classMethod) {
          console.log(
            `Found member definition for method: ${classMethod.name} of class: ${userClass.name}`
          );
          const position = new vscode.Position(
            classMethod.line - 1,
            classMethod.col
          );

          return new vscode.Location(
            vscode.Uri.file(
              getDefinitionAbsolutePath(
                classMethod.fileName,
                classMethod.folderName
              )!
            ),
            position
          );
        }
      }
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
