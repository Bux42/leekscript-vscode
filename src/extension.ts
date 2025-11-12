import * as vscode from "vscode";

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

        // Keywords
        const keywords = [
          "if",
          "else",
          "while",
          "for",
          "function",
          "return",
          "var",
          "let",
          "const",
          "true",
          "false",
          "null",
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
