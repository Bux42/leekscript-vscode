import * as vscode from "vscode";
import { js_beautify } from "js-beautify";

function fixSets(text: string): string {
  // find all occurrences of Set<...> remove spaces
  const regex = /Set\s*<\s*(?:Set\s*<\s*[^>]+?\s*>\s*|[^>]+?)\s*>/g;
  return text.replace(regex, (match) => {
    return (
      match
        // remove all spaces around < and >
        .replace(/\s+/g, "")
        // put back spaces around |
        .replace(/\|/g, " | ")
    );
  });
}

function fixArrays(text: string): string {
  // find all occurrences of Array<...> remove spaces
  const regex = /Array\s*<\s*(?:Array\s*<\s*[^>]+?\s*>\s*|[^>]+?)\s*>/g;
  return text.replace(regex, (match) => {
    return (
      match
        // remove all spaces around < and >
        .replace(/\s+/g, "")
        // put back spaces around |
        .replace(/\|/g, " | ")
    );
  });
}

function fixMaps(text: string): string {
  // find all occurrences of Map<...> remove spaces
  const regex =
    /Map\s*<\s*(?:Map\s*<\s*[^>]+?\s*>\s*|[^>]+?)\s*,\s*(?:Map\s*<\s*[^>]+?\s*>\s*|[^>]+?)\s*>/g;
  return text.replace(regex, (match) => {
    return (
      match
        // remove all spaces around < and >
        .replace(/\s+/g, "")
        // put back spaces around |
        .replace(/\|/g, " | ")
        // put back spaces after commas
        .replace(/,/g, ", ")
    );
  });
}

/**
 * Provides document formatting for LeekScript
 */
export class LeekScriptFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];
    const text = document.getText();

    // Configure js-beautify options
    const beautifyOptions = {
      indent_size: options.tabSize,
      indent_char: options.insertSpaces ? " " : "\t",
      indent_with_tabs: !options.insertSpaces,
      preserve_newlines: true,
      max_preserve_newlines: 2,
      jslint_happy: false,
      space_after_anon_function: false,
      brace_style: "collapse" as const,
      keep_array_indentation: false,
      keep_function_indentation: false,
      space_before_conditional: true,
      break_chained_methods: false,
      eval_code: false,
      unescape_strings: false,
      wrap_line_length: 0,
    };

    // Format the code using js-beautify
    let formattedText = js_beautify(text, beautifyOptions);

    formattedText = fixArrays(formattedText);
    formattedText = fixMaps(formattedText);
    formattedText = fixSets(formattedText);

    // Create a single edit that replaces the entire document
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(text.length)
    );

    edits.push(vscode.TextEdit.replace(fullRange, formattedText));

    return edits;
  }
}

/**
 * Provides range formatting for LeekScript
 */
export class LeekScriptRangeFormattingProvider
  implements vscode.DocumentRangeFormattingEditProvider
{
  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];
    const text = document.getText(range);

    // Configure js-beautify options
    const beautifyOptions = {
      indent_size: options.tabSize,
      indent_char: options.insertSpaces ? " " : "\t",
      indent_with_tabs: !options.insertSpaces,
      preserve_newlines: true,
      max_preserve_newlines: 2,
      jslint_happy: false,
      space_after_anon_function: false,
      brace_style: "collapse" as const,
      keep_array_indentation: false,
      keep_function_indentation: false,
      space_before_conditional: true,
      break_chained_methods: false,
      eval_code: false,
      unescape_strings: false,
      wrap_line_length: 0,
    };

    // Format the code using js-beautify
    let formattedText = js_beautify(text, beautifyOptions);

    formattedText = fixArrays(formattedText);
    formattedText = fixMaps(formattedText);
    formattedText = fixSets(formattedText);

    edits.push(vscode.TextEdit.replace(range, formattedText));

    return edits;
  }
}
