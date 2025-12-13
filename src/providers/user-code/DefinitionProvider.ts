import * as vscode from "vscode";
import { DefinitionManager } from "./DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";
import { getDefinitionAbsolutePath } from "../../utils/DefinitionUtils";
import { getMemberAccessStringAtCursor } from "../../utils/UserCodeUtils";
import { ResolvedMember, resolveMembers } from "../../utils/ClassMemberUtils";

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
      const resolvedMember: ResolvedMember | null = resolveMembers(
        memberParts,
        this.definitionProvider
      );
      if (resolvedMember) {
        if (resolvedMember.field) {
          return this.createUserVariableDefinition(resolvedMember.field);
        }
        if (resolvedMember.method) {
          return this.createUserFunctionDefinition(resolvedMember.method);
        }
      }
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
