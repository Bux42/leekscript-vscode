import * as vscode from "vscode";
import * as path from "path";

/**
 * Get the absolute path of a definition in the user's project
 * @param fileName
 * @param folderName
 * @returns the absolute path of the definition in the user's project
 */
export const getDefinitionAbsolutePath = (
  fileName: string,
  folderName: string
): string => {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;

  let absolutePath;

  // user-code is already in the path, so we remove it from the path
  if (folderName == "user-code") {
    absolutePath = path.join(workspaceRoot, fileName);
  } else {
    absolutePath = path.join(
      workspaceRoot,
      folderName.replace("user-code\\", ""),
      fileName
    );
  }

  return absolutePath;
};

/**
 *  Get the markdown command link to go to definition
 * @param fileName
 * @param folderName
 * @param line
 * @param col
 * @returns  the markdown command link to go to definition
 */
export const getMarkdownGoToDefinitionCommand = (
  fileName: string,
  folderName: string,
  line: number,
  col: number
): string => {
  const absolutePath = getDefinitionAbsolutePath(fileName, folderName);

  const fileUri = vscode.Uri.file(absolutePath);
  const position = new vscode.Position(line - 1, col);
  return (
    `[Go to definition](` +
    `command:myExt.openDefinition?${encodeURIComponent(
      JSON.stringify([fileUri, position])
    )})`
  );
};
