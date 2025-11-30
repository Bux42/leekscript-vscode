import * as vscode from "vscode";

/**
 * From the user cursor position, return the string before the cursor until a whitespace or special character is found
 * @param document The text document
 * @param position The cursor position
 * @returns The string before the cursor
 */
export function getStringBeforeCursor(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const lineText = document.lineAt(position).text;
  const cursorIndex = position.character;

  let startIndex = cursorIndex - 1;

  while (startIndex >= 0) {
    const char = lineText.charAt(startIndex);
    // stop at whitespace
    if (/\s/.test(char)) {
      break;
    }
    startIndex--;
  }

  return lineText.substring(startIndex + 1, cursorIndex);
}
