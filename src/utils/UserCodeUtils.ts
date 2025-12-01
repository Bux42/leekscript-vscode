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

/**
 * From the user cursor position, return the full string (before and after) until a whitespace or special character is found
 * @param document The text document
 * @param position The cursor position
 * @returns The full string at the cursor
 */
export function getFullStringAtCursor(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const lineText = document.lineAt(position).text;
  const cursorIndex = position.character;

  let startIndex = cursorIndex - 1;
  let endIndex = cursorIndex;

  // Find the start index
  while (startIndex >= 0) {
    const char = lineText.charAt(startIndex);
    // stop at whitespace
    if (/\s/.test(char)) {
      break;
    }
    startIndex--;
  }

  // Find the end index
  while (endIndex < lineText.length) {
    const char = lineText.charAt(endIndex);
    // stop at whitespace
    if (/\s/.test(char)) {
      break;
    }
    endIndex++;
  }

  return lineText.substring(startIndex + 1, endIndex);
}

/**
 * From the user cursor position, return the member access string (e.g. obj.member1.member2) at the cursor
 * @param document The text document
 * @param position The cursor position
 * @returns The member access string at the cursor
 */
// example: for "obj.member1.member2.member3", if cursor is inside member2, return "obj.member1.member2"

export function getMemberAccessStringAtCursor(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const lineText = document.lineAt(position).text;
  const cursorIndex = position.character;

  let startIndex = cursorIndex;
  let endIndex = cursorIndex;

  // Find the end of the current identifier (move forward to include the rest of the word)
  while (endIndex < lineText.length) {
    const char = lineText.charAt(endIndex);
    // Continue if it's alphanumeric or underscore
    if (/[a-zA-Z0-9_]/.test(char)) {
      endIndex++;
    } else {
      break;
    }
  }

  // Now move backward from the cursor to find the start of the member access chain
  startIndex = cursorIndex - 1;
  while (startIndex >= 0) {
    const char = lineText.charAt(startIndex);
    // Continue if it's part of an identifier (alphanumeric, underscore, or dot)
    if (/[a-zA-Z0-9_.]/.test(char)) {
      startIndex--;
    } else {
      break;
    }
  }

  // Extract the full member access chain from start to end
  const fullChain = lineText.substring(startIndex + 1, endIndex);

  // If cursor is after a dot, return everything up to and including the dot
  if (cursorIndex > 0 && lineText.charAt(cursorIndex - 1) === ".") {
    return fullChain.substring(0, fullChain.lastIndexOf(".") + 1);
  }

  // Find which member the cursor is in by counting dots
  // Return everything up to and including the current member
  let dotCount = 0;
  let currentIndex = 0;

  for (let i = 0; i < fullChain.length; i++) {
    if (fullChain.charAt(i) === ".") {
      dotCount++;
    }
    // Check if we've reached the cursor position in the chain
    if (startIndex + 1 + i >= cursorIndex) {
      // Find the end of the current member
      currentIndex = i;
      while (
        currentIndex < fullChain.length &&
        fullChain.charAt(currentIndex) !== "."
      ) {
        currentIndex++;
      }
      break;
    }
  }

  return fullChain.substring(0, currentIndex);
}
