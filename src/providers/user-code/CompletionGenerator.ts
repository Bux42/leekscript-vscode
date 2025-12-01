import * as vscode from "vscode";
import {
  UserClassField,
  UserMethod,
} from "../../services/analyzer/definitions.types";

/**
 * Generate a completion item for a user class field
 * @param field The user class field
 * @returns The completion item
 */
export const generateUserClassFieldCompletion = (
  field: UserClassField
): vscode.CompletionItem => {
  const item = new vscode.CompletionItem(
    field.name,
    vscode.CompletionItemKind.Field
  );
  item.detail = `field ${field.name}: ${field.type}`;
  item.documentation = new vscode.MarkdownString(
    `Field **${field.name}** of type **${field.type}**`
  );
  return item;
};

/**
 * Generate a completion item for a class method
 * @param methodName The method name
 * @returns The completion item
 */
export const generateUserClassMethodCompletion = (
  method: UserMethod
): vscode.CompletionItem => {
  const item = new vscode.CompletionItem(
    method.name,
    vscode.CompletionItemKind.Method
  );
  item.detail = `method ${method.name}()`;
  item.documentation = new vscode.MarkdownString(`Method **${method.name}**`);
  return item;
};
