import * as vscode from "vscode";
import { UserDefinitionLocation } from "../../services/analyzer/definitions.types";
import { getDefinitionAbsolutePath } from "../../utils/DefinitionUtils";

/**
 * Tries to get the comment documentation before the definition location
 * @param definitionLocation
 * @returns The documentation string or null if not found
 */
export const tryGetDefinitionDocumentation = (
  definitionLocation: UserDefinitionLocation
): string | null => {
  if (!definitionLocation) {
    return null;
  }

  const { fileName, folderName, line } = definitionLocation;

  // Get the absolute path to the file
  const absolutePath = getDefinitionAbsolutePath(fileName, folderName);
  if (!absolutePath) {
    return null;
  }

  // Find the file in the workspace
  const fileUri = vscode.Uri.file(absolutePath);

  try {
    // Open the document
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.fsPath === fileUri.fsPath
    );

    if (!document) {
      // Document is not open, we can't read it synchronously
      return null;
    }

    // Check if there's a line before the definition
    if (line <= 1) {
      return null;
    }

    // Get the line before the definition (line numbers are 1-indexed in our data)
    const previousLineIndex = line - 2;
    const previousLine = document.lineAt(previousLineIndex);
    const previousLineText = previousLine.text.trim();

    // Check if it's a comment line
    if (previousLineText.startsWith("//")) {
      // Single-line comment
      const commentText = previousLineText.substring(2).trim();
      return commentText || null;
    } else if (
      previousLineText.startsWith("/*") ||
      previousLineText.endsWith("*/")
    ) {
      // Multi-line comment or JSDoc comment
      let documentation = "";
      let currentLineIndex = previousLineIndex;

      // Find the start of the comment block if we're at the end
      if (
        previousLineText.endsWith("*/") &&
        !previousLineText.startsWith("/*")
      ) {
        // We need to scan upwards to find the start
        while (currentLineIndex >= 0) {
          const lineText = document.lineAt(currentLineIndex).text.trim();
          if (lineText.startsWith("/*") || lineText.startsWith("/**")) {
            break;
          }
          currentLineIndex--;
        }
      }

      // Extract all lines of the comment
      const commentLines: string[] = [];
      while (currentLineIndex <= previousLineIndex) {
        const lineText = document.lineAt(currentLineIndex).text.trim();
        commentLines.push(lineText);
        currentLineIndex++;
      }

      // Parse the comment lines to extract documentation
      for (const commentLine of commentLines) {
        let cleanedLine = commentLine;

        // Remove comment markers
        cleanedLine = cleanedLine.replace(/^\/\*\*?/, "").replace(/\*\/$/, "");
        cleanedLine = cleanedLine.replace(/^\*/, "").trim();

        if (cleanedLine) {
          documentation += (documentation ? "\n" : "") + cleanedLine;
        }
      }

      return documentation || null;
    }

    return null;
  } catch (error) {
    console.error("Error reading documentation:", error);
    return null;
  }
};

/**
 * Append documentation to the given markdown string if available
 * @param definitionLocation
 * @param markdown
 */
export const tryAppendDocumentationToMarkdown = (
  definitionLocation: UserDefinitionLocation,
  markdown: vscode.MarkdownString
): void => {
  const documentation = tryGetDefinitionDocumentation(definitionLocation);
  if (documentation) {
    for (const line of documentation.split("\n")) {
      markdown.appendMarkdown(line + "  \n");
    }
  }
};
