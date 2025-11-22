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
    if (charIndex >= 0 && lineText.charAt(charIndex) === ".") {
      console.log("Definition request triggered after a dot, ignoring.");
      return null;
    }

    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    console.log(`Looking for definition of: ${word}`);

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
