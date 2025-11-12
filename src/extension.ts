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
          let documentation = docData[docKey] || "No documentation available";

          // Add link to encyclopedia at the end of first line
          const encyclopediaUrl = `https://leekwars.com/encyclopedia/en/${func.name}`;
          documentation =
            documentation +
            ` [🔗](${encyclopediaUrl} "View in LeekWars Encyclopedia")`;

          // Get return value description
          const returnDocKey = `func_${func.name}_return`;
          const returnDoc = docData[returnDocKey];

          // Get argument descriptions
          const argDescriptions: string[] = [];
          func.arguments_names.forEach((argName: string, index: number) => {
            const argDocKey = `func_${func.name}_arg_${index + 1}`;
            const argDoc = docData[argDocKey];
            if (argDoc) {
              const argType = getTypeName(func.arguments_types[index]);
              argDescriptions.push(`- **${argName}** (${argType}): ${argDoc}`);
            }
          });

          // Build complete documentation
          const docMarkdown = new vscode.MarkdownString(documentation);
          docMarkdown.supportHtml = true; // Enable HTML rendering

          // Add arguments section if there are descriptions
          if (argDescriptions.length > 0) {
            docMarkdown.appendMarkdown("\n\n**Parameters:**\n");
            docMarkdown.appendMarkdown(argDescriptions.join("\n"));
          }

          // Add return value description if available
          if (returnDoc) {
            docMarkdown.appendMarkdown("\n\n**Return:**\n");
            docMarkdown.appendMarkdown(`${returnDoc}`);
          }

          // Add operations cost
          const operations = func.operations;
          if (operations !== undefined && operations !== null) {
            docMarkdown.appendMarkdown("\n\n");
            if (operations === -1) {
              docMarkdown.appendMarkdown("Complexity **O(n²)**");
            } else {
              docMarkdown.appendMarkdown(`**${operations} operations**`);
            }
          }

          item.documentation = docMarkdown;

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
        let documentation = docData[docKey] || "No documentation available";

        // Add link to encyclopedia at the end of first line
        const encyclopediaUrl = `https://leekwars.com/encyclopedia/en/${func.name}`;
        documentation =
          documentation +
          ` [🔗](${encyclopediaUrl} "View in LeekWars Encyclopedia")`;

        // Get return value description
        const returnDocKey = `func_${func.name}_return`;
        const returnDoc = docData[returnDocKey];

        // Get argument descriptions
        const argDescriptions: string[] = [];
        func.arguments_names.forEach((argName: string, index: number) => {
          const argDocKey = `func_${func.name}_arg_${index + 1}`;
          const argDoc = docData[argDocKey];
          if (argDoc) {
            const argType = getTypeName(func.arguments_types[index]);
            argDescriptions.push(`- **${argName}** (${argType}): ${argDoc}`);
          }
        });

        // Create markdown content
        const markdown = new vscode.MarkdownString();
        markdown.supportHtml = true; // Enable HTML rendering
        markdown.appendCodeblock(signature, "leekscript");
        markdown.appendMarkdown("\n" + documentation);

        // Add arguments section if there are descriptions
        if (argDescriptions.length > 0) {
          markdown.appendMarkdown("\n\n**Parameters:**\n");
          markdown.appendMarkdown(argDescriptions.join("\n"));
        }

        // Add return value description if available
        if (returnDoc) {
          markdown.appendMarkdown("\n\n**Returns:**\n");
          markdown.appendMarkdown(`${returnDoc}`);
        }

        // Add operations cost
        const operations = func.operations;
        if (operations !== undefined && operations !== null) {
          markdown.appendMarkdown("\n\n**Operations:** ");
          if (operations === -1) {
            markdown.appendMarkdown("Variable");
          } else {
            markdown.appendMarkdown(`${operations}`);
          }
        }

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
