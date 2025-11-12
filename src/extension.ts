import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// Load extracted data
const functionsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../extracted/functions.json"), "utf8")
);
const docData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../extracted/doc.en.json"), "utf8")
);

// Type mappings
const typeMap: { [key: string]: string } = {
  "-1": "any",
  "1": "number",
  "2": "string",
  "3": "boolean",
  "4": "array",
  "41": "array<number>",
  "42": "array<string>",
  "43": "array<boolean>",
  "44": "array<array>",
  "46": "array<integer>",
  "47": "array<real>",
  "5": "function",
  "6": "integer",
  "7": "real",
  "8": "map",
};

function getTypeName(typeId: string): string {
  return typeMap[typeId] || "any";
}

export function activate(context: vscode.ExtensionContext) {
  console.log("LeekScript extension is now active!");

  // Register a simple completion provider for LeekScript
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "leekscript",
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // Example: provide some basic keyword completions
        const completionItems: vscode.CompletionItem[] = [];

        // Add function completions from extracted data
        functionsData.forEach((func: any) => {
          const item = new vscode.CompletionItem(
            func.name,
            vscode.CompletionItemKind.Function
          );

          // Build function signature
          const params = func.arguments_names
            .map((name: string, index: number) => {
              const type = getTypeName(func.arguments_types[index]);
              return `${name}: ${type}`;
            })
            .join(", ");

          const returnType = getTypeName(func.return_type.toString());
          const returnName = func.return_name || "result";
          item.detail = `${func.name}(${params}): ${returnType} ${returnName}`;

          // Get documentation from doc.en.json
          const docKey = `func_${func.name}`;
          const documentation = docData[docKey] || "No documentation available";
          item.documentation = new vscode.MarkdownString(documentation);

          // Set insert text with parameter snippets
          const paramSnippets = func.arguments_names
            .map((name: string, index: number) => `\${${index + 1}:${name}}`)
            .join(", ");
          item.insertText = new vscode.SnippetString(
            `${func.name}(${paramSnippets})`
          );

          completionItems.push(item);
        });

        // Keywords
        const keywords = [
          "break",
          "class",
          "continue",
          "constructor",
          "do",
          "else",
          "extends",
          "for",
          "function",
          "if",
          "in",
          "new",
          "return",
          "super",
          "this",
          "var",
          "void",
          "while",
          "private",
          "public",
          "protected",
          "static",
          "not",
          "global",
          "and",
          "or",
          "xor",
          "instanceof",
          "as",
          "final",
        ];

        keywords.forEach((keyword) => {
          const item = new vscode.CompletionItem(
            keyword,
            vscode.CompletionItemKind.Keyword
          );
          completionItems.push(item);
        });

        // Built-in functions (example)
        const builtins = [
          "print",
          "debug",
          "sqrt",
          "pow",
          "abs",
          "floor",
          "ceil",
          "round",
        ];
        builtins.forEach((builtin) => {
          const item = new vscode.CompletionItem(
            builtin,
            vscode.CompletionItemKind.Function
          );
          item.detail = "LeekScript built-in function";
          completionItems.push(item);
        });

        return completionItems;
      },
    }
  );

  context.subscriptions.push(completionProvider);

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider("leekscript", {
    provideHover(document: vscode.TextDocument, position: vscode.Position) {
      const range = document.getWordRangeAtPosition(position);
      const word = document.getText(range);

      // Find the function in functionsData
      const func = functionsData.find((f: any) => f.name === word);
      if (func) {
        // Build function signature
        const params = func.arguments_names
          .map((name: string, index: number) => {
            const type = getTypeName(func.arguments_types[index]);
            return `${name}: ${type}`;
          })
          .join(", ");

        const returnType = getTypeName(func.return_type.toString());
        const returnName = func.return_name || "result";
        const signature = `${func.name}(${params}): ${returnType} (${returnName})`;

        // Get documentation
        const docKey = `func_${func.name}`;
        const documentation = docData[docKey] || "No documentation available";

        // Create markdown content
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(signature, "leekscript");
        markdown.appendMarkdown("\n" + documentation);

        return new vscode.Hover(markdown);
      }

      return null;
    },
  });

  context.subscriptions.push(hoverProvider);

  // Register a command
  let disposable = vscode.commands.registerCommand(
    "leekscript.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello from LeekScript!");
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  console.log("LeekScript extension is now deactivated");
}
