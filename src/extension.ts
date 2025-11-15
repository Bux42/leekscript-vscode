import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LeekWarsService } from "./services/leekwars";
import { CodeAnalyzerService } from "./services/analyzer";

// Load extracted data
const functionsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../extracted/functions.json"), "utf8")
);
const constantsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../extracted/constants.json"), "utf8")
);
const docData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../extracted/doc.en.json"), "utf8")
);

// Store debounce timers for each document
const debounceTimers = new Map<string, NodeJS.Timeout>();

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 500;

// Diagnostic collection for problems
let diagnosticCollection: vscode.DiagnosticCollection;

// Code Analyzer service (will be initialized in activate)
let analyzerService: CodeAnalyzerService | null = null;

// Map to store file path to AI ID mappings
const fileToAIIdMap = new Map<string, number>();

// Build a set of built-in function names for quick lookup
const builtInFunctions = new Set<string>(functionsData.map((f: any) => f.name));

// Type mappings
const builtinFunctionsTypeMap: { [key: string]: string } = {
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

function getBuiltinFunctionTypeName(typeId: string): string {
  return builtinFunctionsTypeMap[typeId] || "any";
}

/**
 * Get or create an AI ID for a given file path
 */
async function getOrCreateAIId(filePath: string): Promise<number | null> {
  // Check if we already have an AI ID for this file
  if (fileToAIIdMap.has(filePath)) {
    return fileToAIIdMap.get(filePath)!;
  }

  if (!analyzerService) {
    return null;
  }

  // Create a new AI file with the same name
  const fileName = path.basename(filePath);
  const ai = await analyzerService.createAI(0, fileName);

  if (ai) {
    fileToAIIdMap.set(filePath, ai.id);
    console.log(`[LeekScript] Mapped ${fileName} to AI ID ${ai.id}`);
    return ai.id;
  }

  return null;
}

/**
 * Convert analysis errors to VSCode diagnostics
 */
function convertAnalysisErrorsToDiagnostics(
  errors: import("./services/analyzer").AnalysisError[]
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const error of errors) {
    const [
      level,
      aiId,
      startLine,
      startCol,
      endLine,
      endCol,
      errorCode,
      params,
    ] = error;

    // Convert to 0-based indexing (server uses 1-based)
    const range = new vscode.Range(
      Math.max(0, startLine - 1),
      Math.max(0, startCol - 1),
      Math.max(0, endLine - 1),
      Math.max(0, endCol - 1)
    );

    const severity =
      level === 0
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

    const message =
      params.length > 0
        ? `[${errorCode}] ${params.join(", ")}`
        : `Error code: ${errorCode}`;

    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = "LeekScript Analyzer";
    diagnostic.code = errorCode;

    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

// Analyze a LeekScript document
async function analyzeDocument(document: vscode.TextDocument): Promise<void> {
  if (
    document.languageId !== "leekscript" &&
    !document.fileName.endsWith(".leek")
  ) {
    return;
  }

  const code = document.getText();
  const name = path.basename(document.fileName);

  // If analyzer service is not available or server is not running, skip analysis
  if (!analyzerService || !analyzerService.getServerStatus()) {
    return;
  }

  try {
    // Get or create AI ID for this file
    const aiId = await getOrCreateAIId(document.fileName);

    if (!aiId) {
      console.error(`[LeekScript] Failed to get AI ID for ${name}`);
      return;
    }

    // Send code to analyzer and get results
    const result = await analyzerService.saveAI(aiId, code);

    if (result) {
      const errors = result.result[aiId.toString()] || [];
      const diagnostics = convertAnalysisErrorsToDiagnostics(errors);

      // Update diagnostics for this document
      diagnosticCollection.set(document.uri, diagnostics);

      const errorCount = errors.filter((e) => e[0] === 0).length;
      const warningCount = errors.filter((e) => e[0] === 1).length;

      if (errorCount > 0 || warningCount > 0) {
        console.log(
          `[LeekScript] Analysis complete for ${name}: ${errorCount} errors, ${warningCount} warnings`
        );
      }
    }
  } catch (error) {
    console.error(`[LeekScript] Analysis failed for ${name}:`, error);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("LeekScript extension is now active!");

  // Create diagnostic collection
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("leekscript");
  context.subscriptions.push(diagnosticCollection);

  // Initialize LeekWars service
  const leekWarsService = new LeekWarsService(context);

  // Check if token is configured on startup
  await leekWarsService.checkTokenAndNotify();

  // Initialize Code Analyzer service
  analyzerService = new CodeAnalyzerService(context);

  // Check if analyzer server is running on startup
  const isAnalyzerRunning = await analyzerService.checkServerStatus();
  if (isAnalyzerRunning) {
    console.log("[LeekScript] Code Analysis Server is running");
  } else {
    console.log(
      "[LeekScript] Code Analysis Server is not running - real-time analysis disabled"
    );
  }

  // Register LeekWars commands
  context.subscriptions.push(
    vscode.commands.registerCommand("leekscript.pullAllAIs", async () => {
      await leekWarsService.pullAllAIs();
    })
  );

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
              const type = getBuiltinFunctionTypeName(
                func.arguments_types[index]
              );
              const isOptional = func.optional && func.optional[index] === true;
              const optionalMark = isOptional ? "?" : "";
              return `${name}${optionalMark}: ${type}`;
            })
            .join(", ");

          const returnType = getBuiltinFunctionTypeName(
            func.return_type.toString()
          );
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
              const argType = getBuiltinFunctionTypeName(
                func.arguments_types[index]
              );
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

        // Add constant completions from extracted data
        constantsData.forEach((constant: any) => {
          const item = new vscode.CompletionItem(
            constant.name,
            vscode.CompletionItemKind.Constant
          );

          // Set detail with value
          item.detail = `${constant.name} = ${constant.value}`;

          // Get documentation from doc.en.json
          const docKey = `const_${constant.name}`;
          let documentation = docData[docKey] || "No documentation available";

          const docMarkdown = new vscode.MarkdownString(documentation);
          docMarkdown.supportHtml = true;
          item.documentation = docMarkdown;

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

        // Type keywords
        const typeKeywords = [
          "any",
          "boolean",
          "number",
          "object",
          "string",
          "undefined",
          "integer",
          "real",
        ];

        typeKeywords.forEach((typeKeyword) => {
          const item = new vscode.CompletionItem(
            typeKeyword,
            vscode.CompletionItemKind.TypeParameter
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

  // Register member completion provider (triggered by ".")
  const memberCompletionProvider =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          const completionItems: vscode.CompletionItem[] = [];

          return completionItems;
        },
      },
      "." // Trigger character
    );

  context.subscriptions.push(memberCompletionProvider);

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider("leekscript", {
    provideHover(document: vscode.TextDocument, position: vscode.Position) {
      const range = document.getWordRangeAtPosition(position);
      const word = document.getText(range);

      // TODO: Check user-defined symbols first

      // Find the function in functionsData
      const func = functionsData.find((f: any) => f.name === word);
      if (func) {
        // Build function signature
        const params = func.arguments_names
          .map((name: string, index: number) => {
            const type = getBuiltinFunctionTypeName(
              func.arguments_types[index]
            );
            const isOptional = func.optional && func.optional[index] === true;
            const optionalMark = isOptional ? "?" : "";
            return `${name}${optionalMark}: ${type}`;
          })
          .join(", ");

        const returnType = getBuiltinFunctionTypeName(
          func.return_type.toString()
        );
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
            const argType = getBuiltinFunctionTypeName(
              func.arguments_types[index]
            );
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

      // Check if it's a constant
      const constant = constantsData.find((c: any) => c.name === word);
      if (constant) {
        // Get documentation
        const docKey = `const_${constant.name}`;
        let documentation = docData[docKey] || "No documentation available";

        // Create markdown content
        const markdown = new vscode.MarkdownString();
        markdown.supportHtml = true;
        markdown.appendCodeblock(
          `const ${constant.name} = ${constant.value}`,
          "leekscript"
        );
        markdown.appendMarkdown("\n" + documentation);

        return new vscode.Hover(markdown);
      }

      return null;
    },
  });

  context.subscriptions.push(hoverProvider);

  // Register definition provider for Go to Definition
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "leekscript",
    {
      provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        return null;
      },
    }
  );

  context.subscriptions.push(definitionProvider);

  // Register a command
  let disposable = vscode.commands.registerCommand(
    "leekscript.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello from LeekScript!");
    }
  );

  context.subscriptions.push(disposable);

  // Register file save listener for .leek files
  const saveListener = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      if (
        document.languageId === "leekscript" ||
        document.fileName.endsWith(".leek")
      ) {
        const uri = document.uri.toString();

        // Clear any pending debounce timer for immediate analysis on save
        if (debounceTimers.has(uri)) {
          clearTimeout(debounceTimers.get(uri)!);
          debounceTimers.delete(uri);
        }

        // Analyze the document immediately
        await analyzeDocument(document);

        // Get relative path
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
          document.uri
        );
        const relativePath = workspaceFolder
          ? vscode.workspace.asRelativePath(document.uri, false)
          : document.fileName;

        const content = document.getText();

        console.log(`LeekScript file saved: ${relativePath}`);

        // TODO: Send content to local server
      }
    }
  );

  context.subscriptions.push(saveListener);

  // Register file/folder delete listener
  const deleteListener = vscode.workspace.onDidDeleteFiles((event) => {
    event.files.forEach((uri) => {
      // Get relative path
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const relativePath = workspaceFolder
        ? vscode.workspace.asRelativePath(uri, false)
        : uri.fsPath;

      const filePath = uri.fsPath;

      // Check if it's a .leek file
      if (filePath.endsWith(".leek")) {
        console.log(`LeekScript file deleted: ${relativePath}`);
      } else {
        // Check if it's a folder - try to determine if it contained .leek files
        // Note: We can't check the contents after deletion, but we can log folder deletions
        console.log(
          `Folder or file deleted: ${relativePath} (may have contained .leek files)`
        );
      }
    });
  });

  context.subscriptions.push(deleteListener);

  // Analyze all currently open documents
  vscode.workspace.textDocuments.forEach(async (document) => {
    if (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    ) {
      await analyzeDocument(document);
    }
  });

  // Register document open listener
  const openListener = vscode.workspace.onDidOpenTextDocument(
    async (document) => {
      if (
        document.languageId === "leekscript" ||
        document.fileName.endsWith(".leek")
      ) {
        await analyzeDocument(document);
      }
    }
  );

  context.subscriptions.push(openListener);

  // Register document change listener for real-time analysis with debouncing
  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    const document = event.document;
    if (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    ) {
      const uri = document.uri.toString();

      // Clear existing timer for this document
      if (debounceTimers.has(uri)) {
        clearTimeout(debounceTimers.get(uri)!);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        await analyzeDocument(document);
        debounceTimers.delete(uri);
      }, DEBOUNCE_DELAY);

      debounceTimers.set(uri, timer);
    }
  });

  context.subscriptions.push(changeListener);

  // Register document close listener to clean up
  const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
    const uri = document.uri.toString();

    // Clear any pending debounce timer
    if (debounceTimers.has(uri)) {
      clearTimeout(debounceTimers.get(uri)!);
      debounceTimers.delete(uri);
    }
    console.log(`LeekScript document closed: ${document.fileName}`);
  });

  context.subscriptions.push(closeListener);
}

export function deactivate() {
  console.log("LeekScript extension is now deactivated");
  if (diagnosticCollection) {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
  }
}
