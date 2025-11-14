import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LeekScriptAnalyzer } from "./analyzer";
import { LeekWarsService } from "./services/leekwars";

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

// Store analyzers for each document
const documentAnalyzers = new Map<string, LeekScriptAnalyzer>();

// Store debounce timers for each document
const debounceTimers = new Map<string, NodeJS.Timeout>();

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 500;

// Diagnostic collection for problems
let diagnosticCollection: vscode.DiagnosticCollection;

// Build a set of built-in function names for quick lookup
const builtInFunctions = new Set<string>(functionsData.map((f: any) => f.name));

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
  const analyzer = new LeekScriptAnalyzer(code, name, builtInFunctions);
  await analyzer.analyze();

  // Store the analyzer first (before resolving includes to avoid circular references)
  documentAnalyzers.set(document.uri.toString(), analyzer);

  // Resolve includes
  const includedAnalyzers: LeekScriptAnalyzer[] = [];
  for (const includePath of analyzer.includes) {
    const resolvedUri = resolveIncludePath(document.uri, includePath);
    if (resolvedUri) {
      // Check if the included file is already analyzed
      let includedAnalyzer = documentAnalyzers.get(resolvedUri.toString());

      if (!includedAnalyzer) {
        // Try to load and analyze the included file
        try {
          const includedDocument = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.toString() === resolvedUri.toString()
          );

          if (includedDocument) {
            const includedCode = includedDocument.getText();
            const includedName = path.basename(includedDocument.fileName);
            includedAnalyzer = new LeekScriptAnalyzer(
              includedCode,
              includedName,
              builtInFunctions
            );
            await includedAnalyzer.analyze();
            documentAnalyzers.set(resolvedUri.toString(), includedAnalyzer);
          } else {
            // File not open, try to read it
            const includedCode = fs.readFileSync(resolvedUri.fsPath, "utf8");
            const includedName = path.basename(resolvedUri.fsPath);
            includedAnalyzer = new LeekScriptAnalyzer(
              includedCode,
              includedName,
              builtInFunctions
            );
            await includedAnalyzer.analyze();
            documentAnalyzers.set(resolvedUri.toString(), includedAnalyzer);
          }
        } catch (error) {
          // File not found or error reading
          console.error(`Error loading included file ${includePath}:`, error);
        }
      }

      if (includedAnalyzer) {
        includedAnalyzers.push(includedAnalyzer);
      }
    }
  }

  analyzer.setIncludedAnalyzers(includedAnalyzers);

  // Re-run analysis to check for undefined functions with includes resolved
  await analyzer.analyze();

  // Update diagnostics
  updateDiagnostics(document, analyzer);
}

// Resolve include path relative to the current file
function resolveIncludePath(
  currentUri: vscode.Uri,
  includePath: string
): vscode.Uri | null {
  try {
    const currentDir = path.dirname(currentUri.fsPath);
    let resolvedPath: string;

    // If the path doesn't have an extension, add .leek
    if (!includePath.endsWith(".leek") && !includePath.endsWith(".ls")) {
      includePath += ".leek";
    }

    // Resolve relative to current file
    resolvedPath = path.resolve(currentDir, includePath);

    // Check if file exists
    if (fs.existsSync(resolvedPath)) {
      return vscode.Uri.file(resolvedPath);
    }

    return null;
  } catch (error) {
    console.error(`Error resolving include path ${includePath}:`, error);
    return null;
  }
}

// Update diagnostics for a document
function updateDiagnostics(
  document: vscode.TextDocument,
  analyzer: LeekScriptAnalyzer
): void {
  const diagnostics: vscode.Diagnostic[] = [];

  // Add problems detected by analyzer
  analyzer.problems.forEach((problem) => {
    const line = problem.line - 1; // Convert to 0-based
    const range = new vscode.Range(
      new vscode.Position(line, 0),
      new vscode.Position(
        line,
        document.lineAt(Math.min(line, document.lineCount - 1)).text.length
      )
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      problem.message,
      problem.severity
    );
    diagnostics.push(diagnostic);
  });

  // Add info for TODOs found in comments
  if (analyzer.todos > 0) {
    const range = new vscode.Range(0, 0, 0, 0);
    const diagnostic = new vscode.Diagnostic(
      range,
      `${analyzer.todos} TODO(s) found in comments`,
      vscode.DiagnosticSeverity.Information
    );
    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

export function activate(context: vscode.ExtensionContext) {
  console.log("LeekScript extension is now active!");

  // Create diagnostic collection
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("leekscript");
  context.subscriptions.push(diagnosticCollection);

  // Initialize LeekWars service
  const leekWarsService = new LeekWarsService(context);

  // Register LeekWars commands
  context.subscriptions.push(
    vscode.commands.registerCommand("leekscript.pullAllAIs", async () => {
      await leekWarsService.pullAllAIs();
    })
  );

  // context.subscriptions.push(
  //   vscode.commands.registerCommand("leekscript.pullAI", async () => {
  //     await leekWarsService.selectAndPullAI();
  //   })
  // );

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
              const isOptional = func.optional && func.optional[index] === true;
              const optionalMark = isOptional ? "?" : "";
              return `${name}${optionalMark}: ${type}`;
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

        // Add user-defined symbols from analyzer
        const analyzer = documentAnalyzers.get(document.uri.toString());
        if (analyzer) {
          // Add user-defined functions (including from includes)
          const allFunctions = analyzer.getAllAvailableFunctions();
          allFunctions.forEach((func) => {
            const item = new vscode.CompletionItem(
              func.label,
              vscode.CompletionItemKind.Function
            );
            item.detail = func.fullName + ": " + func.returnType;

            const docMarkdown = new vscode.MarkdownString();
            docMarkdown.appendMarkdown(
              `**User Function** (line ${func.line})\n\n`
            );
            if (func.javadoc.description) {
              docMarkdown.appendMarkdown(func.javadoc.description + "\n\n");
            }

            // Add parameters
            if (func.arguments.length > 0) {
              docMarkdown.appendMarkdown("**Parameters:**\n");
              func.arguments.forEach((arg, i) => {
                const type = func.argumentTypes[i];
                const paramDoc = func.javadoc.items.find(
                  (item: any) => item.type === "param" && item.name === arg
                );
                const description = paramDoc?.text || "";
                docMarkdown.appendMarkdown(
                  `- **${arg}** (${type}): ${description}\n`
                );
              });
            }

            // Add return
            const returnDoc = func.javadoc.items.find(
              (item: any) => item.type === "return"
            );
            if (returnDoc) {
              docMarkdown.appendMarkdown("\n**Return:**\n");
              docMarkdown.appendMarkdown(returnDoc.text || "");
            }

            item.documentation = docMarkdown;
            item.insertText = new vscode.SnippetString(func.insertText);
            completionItems.push(item);
          });

          // Add user-defined classes (including from includes)
          const allClasses = analyzer.getAllAvailableClasses();
          allClasses.forEach((clazz) => {
            const item = new vscode.CompletionItem(
              clazz.label,
              vscode.CompletionItemKind.Class
            );
            item.detail = `class ${clazz.label} (line ${clazz.line})`;

            const docMarkdown = new vscode.MarkdownString();
            docMarkdown.appendMarkdown(
              `**User Class** (line ${clazz.line})\n\n`
            );
            if (clazz.javadoc.description) {
              docMarkdown.appendMarkdown(clazz.javadoc.description);
            }

            item.documentation = docMarkdown;
            completionItems.push(item);
          });

          // Add global variables (including from includes)
          const allGlobals = analyzer.getAllAvailableGlobals();
          allGlobals.forEach((global) => {
            const item = new vscode.CompletionItem(
              global.label,
              vscode.CompletionItemKind.Variable
            );
            item.detail = `global ${global.label} (line ${global.line})`;

            const docMarkdown = new vscode.MarkdownString();
            docMarkdown.appendMarkdown(
              `**Global Variable** (line ${global.line})\n\n`
            );
            if (global.javadoc.description) {
              docMarkdown.appendMarkdown(global.javadoc.description);
            }

            item.documentation = docMarkdown;
            completionItems.push(item);
          });
        }

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

          const analyzer = documentAnalyzers.get(document.uri.toString());
          if (!analyzer) {
            return completionItems;
          }

          // Get the text before the dot
          const line = document.lineAt(position.line);
          const textBeforeCursor = line.text.substring(0, position.character);
          const memberAccessMatch = textBeforeCursor.match(/(\w+)\s*\.$/);

          if (!memberAccessMatch) {
            return completionItems;
          }

          const objectOrClassName = memberAccessMatch[1];

          // Check if it's a class name (for static members)
          const allClasses = analyzer.getAllAvailableClasses();
          const clazz = allClasses.get(objectOrClassName);

          if (clazz) {
            // Add static methods
            clazz.staticMethods.forEach((method) => {
              const item = new vscode.CompletionItem(
                method.label,
                vscode.CompletionItemKind.Method
              );
              item.detail = `static ${method.fullName}: ${method.returnType}`;

              const docMarkdown = new vscode.MarkdownString();
              docMarkdown.appendMarkdown(
                `**Static Method** (line ${method.line})\n\n`
              );
              if (method.javadoc.description) {
                docMarkdown.appendMarkdown(method.javadoc.description);
              }

              item.documentation = docMarkdown;
              item.insertText = new vscode.SnippetString(method.insertText);
              completionItems.push(item);
            });

            // Add static fields
            clazz.staticFields.forEach((field) => {
              const item = new vscode.CompletionItem(
                field.label,
                vscode.CompletionItemKind.Field
              );
              item.detail = `static ${field.type} ${field.label}`;

              const docMarkdown = new vscode.MarkdownString();
              docMarkdown.appendMarkdown(
                `**Static Field** (line ${field.line})\n\n`
              );
              if (field.javadoc.description) {
                docMarkdown.appendMarkdown(field.javadoc.description);
              }

              item.documentation = docMarkdown;
              completionItems.push(item);
            });

            // Add instance methods (for when objectOrClassName is a class name but accessing instance members)
            clazz.methods.forEach((method) => {
              const item = new vscode.CompletionItem(
                method.label,
                vscode.CompletionItemKind.Method
              );
              item.detail = `${method.fullName}: ${method.returnType}`;

              const docMarkdown = new vscode.MarkdownString();
              docMarkdown.appendMarkdown(
                `**Method** (line ${method.line})\n\n`
              );
              if (method.javadoc.description) {
                docMarkdown.appendMarkdown(method.javadoc.description);
              }

              item.documentation = docMarkdown;
              item.insertText = new vscode.SnippetString(method.insertText);
              completionItems.push(item);
            });

            // Add instance fields
            clazz.fields.forEach((field) => {
              const item = new vscode.CompletionItem(
                field.label,
                vscode.CompletionItemKind.Field
              );
              item.detail = `${field.type} ${field.label}`;

              const docMarkdown = new vscode.MarkdownString();
              docMarkdown.appendMarkdown(`**Field** (line ${field.line})\n\n`);
              if (field.javadoc.description) {
                docMarkdown.appendMarkdown(field.javadoc.description);
              }

              item.documentation = docMarkdown;
              completionItems.push(item);
            });
          } else {
            // Not a class name - could be an instance variable
            // Show members from all classes (we'd need proper type tracking for better results)
            for (const [, classInfo] of allClasses) {
              // Add instance methods
              classInfo.methods.forEach((method) => {
                const item = new vscode.CompletionItem(
                  method.label,
                  vscode.CompletionItemKind.Method
                );
                item.detail = `${method.fullName}: ${method.returnType}`;

                const docMarkdown = new vscode.MarkdownString();
                docMarkdown.appendMarkdown(
                  `**Method** (line ${method.line})\n\n`
                );
                if (method.javadoc.description) {
                  docMarkdown.appendMarkdown(method.javadoc.description);
                }

                item.documentation = docMarkdown;
                item.insertText = new vscode.SnippetString(method.insertText);
                completionItems.push(item);
              });

              // Add instance fields
              classInfo.fields.forEach((field) => {
                const item = new vscode.CompletionItem(
                  field.label,
                  vscode.CompletionItemKind.Field
                );
                item.detail = `${field.type} ${field.label}`;

                const docMarkdown = new vscode.MarkdownString();
                docMarkdown.appendMarkdown(
                  `**Field** (line ${field.line})\n\n`
                );
                if (field.javadoc.description) {
                  docMarkdown.appendMarkdown(field.javadoc.description);
                }

                item.documentation = docMarkdown;
                completionItems.push(item);
              });
            }
          }

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

      // Check user-defined symbols first
      const analyzer = documentAnalyzers.get(document.uri.toString());
      if (analyzer) {
        // Check user-defined functions (including from includes)
        const allFunctions = analyzer.getAllAvailableFunctions();
        const userFunc = allFunctions.find((f) => f.label === word);
        if (userFunc) {
          // Find which file contains this function
          let location = "";
          if (analyzer.functions.find((f) => f.label === word)) {
            // In current file
            location = `${document.uri.fsPath}:${userFunc.line}`;
          } else {
            // In included file
            for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
              if (includedAnalyzer.functions.find((f) => f.label === word)) {
                for (const [uri, cachedAnalyzer] of documentAnalyzers) {
                  if (cachedAnalyzer === includedAnalyzer) {
                    const fileUri = vscode.Uri.parse(uri);
                    location = `${fileUri.fsPath}:${userFunc.line}`;
                    break;
                  }
                }
                break;
              }
            }
          }

          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(
            userFunc.fullName + ": " + userFunc.returnType,
            "leekscript"
          );
          markdown.appendMarkdown(`\n**User Function**\n\n`);
          if (location) {
            markdown.appendMarkdown(`*Defined at: ${location}*\n\n`);
          }

          if (userFunc.javadoc.description) {
            markdown.appendMarkdown(userFunc.javadoc.description + "\n\n");
          }

          if (userFunc.arguments.length > 0) {
            markdown.appendMarkdown("**Parameters:**\n");
            userFunc.arguments.forEach((arg, i) => {
              const type = userFunc.argumentTypes[i];
              const paramDoc = userFunc.javadoc.items.find(
                (item: any) => item.type === "param" && item.name === arg
              );
              const description = paramDoc?.text || "";
              markdown.appendMarkdown(
                `- **${arg}** (${type}): ${description}\n`
              );
            });
          }

          const returnDoc = userFunc.javadoc.items.find(
            (item: any) => item.type === "return"
          );
          if (returnDoc) {
            markdown.appendMarkdown("\n**Return:**\n");
            markdown.appendMarkdown(returnDoc.text || "");
          }

          return new vscode.Hover(markdown);
        }

        // Check user-defined classes (including from includes)
        const allClasses = analyzer.getAllAvailableClasses();
        const userClass = allClasses.get(word);
        if (userClass) {
          // Find which file contains this class
          let location = "";
          if (analyzer.classes.has(word)) {
            // In current file
            location = `${document.uri.fsPath}:${userClass.line}`;
          } else {
            // In included file
            for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
              if (includedAnalyzer.classes.has(word)) {
                for (const [uri, cachedAnalyzer] of documentAnalyzers) {
                  if (cachedAnalyzer === includedAnalyzer) {
                    const fileUri = vscode.Uri.parse(uri);
                    location = `${fileUri.fsPath}:${userClass.line}`;
                    break;
                  }
                }
                break;
              }
            }
          }

          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(`class ${userClass.label}`, "leekscript");
          markdown.appendMarkdown(`\n**User Class**\n\n`);
          if (location) {
            markdown.appendMarkdown(`*Defined at: ${location}*\n\n`);
          }

          if (userClass.javadoc.description) {
            markdown.appendMarkdown(userClass.javadoc.description);
          }

          return new vscode.Hover(markdown);
        }

        // Check global variables (including from includes)
        const allGlobals = analyzer.getAllAvailableGlobals();
        const global = allGlobals.get(word);
        if (global) {
          // Find which file contains this global
          let location = "";
          if (analyzer.globals.has(word)) {
            // In current file
            location = `${document.uri.fsPath}:${global.line}`;
          } else {
            // In included file
            for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
              if (includedAnalyzer.globals.has(word)) {
                for (const [uri, cachedAnalyzer] of documentAnalyzers) {
                  if (cachedAnalyzer === includedAnalyzer) {
                    const fileUri = vscode.Uri.parse(uri);
                    location = `${fileUri.fsPath}:${global.line}`;
                    break;
                  }
                }
                break;
              }
            }
          }

          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(`global ${global.label}`, "leekscript");
          markdown.appendMarkdown(`\n**Global Variable**\n\n`);
          if (location) {
            markdown.appendMarkdown(`*Defined at: ${location}*\n\n`);
          }
          if (global.javadoc.description) {
            markdown.appendMarkdown(global.javadoc.description);
          }

          return new vscode.Hover(markdown);
        }

        // Check if it's a function/method parameter or local variable
        const variableType = analyzer.getVariableType(word);
        if (variableType) {
          // Check if it's a function parameter
          const allFunctions = analyzer.getAllAvailableFunctions();
          let isParameter = false;
          let parentFunction = "";

          for (const func of allFunctions) {
            const paramIndex = func.arguments.indexOf(word);
            if (paramIndex !== -1) {
              isParameter = true;
              parentFunction = func.label;
              break;
            }
          }

          // Check if it's a method parameter
          if (!isParameter) {
            const allClasses = analyzer.getAllAvailableClasses();
            for (const [className, clazz] of allClasses) {
              // Check method parameters (including constructor)
              for (const method of [...clazz.methods, ...clazz.staticMethods]) {
                const paramIndex = method.arguments?.indexOf(word);
                if (paramIndex !== -1) {
                  isParameter = true;
                  const methodName =
                    method.label === "constructor"
                      ? `${className}.constructor`
                      : `${className}.${method.label}`;
                  parentFunction = methodName;
                  break;
                }
              }
              if (isParameter) break;
            }
          }

          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(`${variableType} ${word}`, "leekscript");

          if (isParameter) {
            markdown.appendMarkdown(
              `\n**Parameter** of \`${parentFunction}\`\n\n`
            );
          } else {
            markdown.appendMarkdown(`\n**Local Variable**\n\n`);
          }

          markdown.appendMarkdown(`Type: \`${variableType}\``);

          return new vscode.Hover(markdown);
        }
      }

      // Find the function in functionsData
      const func = functionsData.find((f: any) => f.name === word);
      if (func) {
        // Build function signature
        const params = func.arguments_names
          .map((name: string, index: number) => {
            const type = getTypeName(func.arguments_types[index]);
            const isOptional = func.optional && func.optional[index] === true;
            const optionalMark = isOptional ? "?" : "";
            return `${name}${optionalMark}: ${type}`;
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

        const analyzer = documentAnalyzers.get(document.uri.toString());
        if (!analyzer) {
          return null;
        }

        // Check if this is a member access (e.g., obj.method or ClassName.staticMethod)
        const line = document.lineAt(position.line);
        const textBeforeCursor = line.text.substring(
          0,
          range?.start.character || position.character
        );
        const memberAccessMatch = textBeforeCursor.match(/(\w+)\s*\.$/);

        if (memberAccessMatch) {
          const objectOrClassName = memberAccessMatch[1];

          // Check if it's a class name (for static member access)
          const allClasses = analyzer.getAllAvailableClasses();
          const clazz = allClasses.get(objectOrClassName);

          if (clazz) {
            // Look for static methods
            const staticMethod = clazz.staticMethods.find(
              (m) => m.label === word
            );
            if (staticMethod) {
              // Find which file contains this class
              const sourceAnalyzer = analyzer.classes.has(objectOrClassName)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(objectOrClassName));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(objectOrClassName)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = staticMethod.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }

            // Look for static fields
            const staticField = clazz.staticFields.find(
              (f) => f.label === word
            );
            if (staticField) {
              const sourceAnalyzer = analyzer.classes.has(objectOrClassName)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(objectOrClassName));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(objectOrClassName)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = staticField.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }

            // Look for instance methods (when called on class instances)
            const method = clazz.methods.find((m) => m.label === word);
            if (method) {
              const sourceAnalyzer = analyzer.classes.has(objectOrClassName)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(objectOrClassName));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(objectOrClassName)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = method.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }

            // Look for instance fields
            const field = clazz.fields.find((f) => f.label === word);
            if (field) {
              const sourceAnalyzer = analyzer.classes.has(objectOrClassName)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(objectOrClassName));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(objectOrClassName)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = field.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }
          }

          // If not a class, it could be an instance variable - we'd need type inference
          // For now, try to find methods/fields in all classes that match
          for (const [className, clazz] of allClasses) {
            // Check instance methods
            const method = clazz.methods.find((m) => m.label === word);
            if (method) {
              const sourceAnalyzer = analyzer.classes.has(className)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(className));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(className)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = method.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }

            // Check instance fields
            const field = clazz.fields.find((f) => f.label === word);
            if (field) {
              const sourceAnalyzer = analyzer.classes.has(className)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(className));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(className)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = field.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }
          }
        }

        // Check user-defined functions in current file
        const userFunc = analyzer.functions.find((f) => f.label === word);
        if (userFunc) {
          const line = userFunc.line - 1; // Convert to 0-based
          return new vscode.Location(
            document.uri,
            new vscode.Position(line, 0)
          );
        }

        // Check functions in included files
        for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
          const includedFunc = includedAnalyzer.functions.find(
            (f) => f.label === word
          );
          if (includedFunc) {
            // Find the URI of the included file
            for (const [uri, cachedAnalyzer] of documentAnalyzers) {
              if (cachedAnalyzer === includedAnalyzer) {
                const line = includedFunc.line - 1;
                return new vscode.Location(
                  vscode.Uri.parse(uri),
                  new vscode.Position(line, 0)
                );
              }
            }
          }
        }

        // Check classes
        const allClasses = analyzer.getAllAvailableClasses();
        const userClass = allClasses.get(word);
        if (userClass) {
          // Find which file contains this class
          if (analyzer.classes.has(word)) {
            // In current file
            const line = userClass.line - 1;
            return new vscode.Location(
              document.uri,
              new vscode.Position(line, 0)
            );
          } else {
            // In included file
            for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
              if (includedAnalyzer.classes.has(word)) {
                for (const [uri, cachedAnalyzer] of documentAnalyzers) {
                  if (cachedAnalyzer === includedAnalyzer) {
                    const line = userClass.line - 1;
                    return new vscode.Location(
                      vscode.Uri.parse(uri),
                      new vscode.Position(line, 0)
                    );
                  }
                }
              }
            }
          }
        }

        // Check global variables
        const allGlobals = analyzer.getAllAvailableGlobals();
        const global = allGlobals.get(word);
        if (global) {
          if (analyzer.globals.has(word)) {
            // In current file
            const line = global.line - 1;
            return new vscode.Location(
              document.uri,
              new vscode.Position(line, 0)
            );
          } else {
            // In included file
            for (const includedAnalyzer of analyzer.getIncludedAnalyzers()) {
              if (includedAnalyzer.globals.has(word)) {
                for (const [uri, cachedAnalyzer] of documentAnalyzers) {
                  if (cachedAnalyzer === includedAnalyzer) {
                    const line = global.line - 1;
                    return new vscode.Location(
                      vscode.Uri.parse(uri),
                      new vscode.Position(line, 0)
                    );
                  }
                }
              }
            }
          }
        }

        // Check if it's a function parameter
        const allFunctions = analyzer.getAllAvailableFunctions();
        for (const func of allFunctions) {
          const paramIndex = func.arguments.indexOf(word);
          if (paramIndex !== -1) {
            // Navigate to the function definition line
            // The parameter is defined in the function signature
            const line = func.line - 1;
            return new vscode.Location(
              document.uri,
              new vscode.Position(line, 0)
            );
          }
        }

        // Check if it's a method parameter (including constructor)
        const availableClasses = analyzer.getAllAvailableClasses();
        for (const [className, clazz] of availableClasses) {
          for (const method of [...clazz.methods, ...clazz.staticMethods]) {
            const paramIndex = method.arguments.indexOf(word);
            if (paramIndex !== -1) {
              // Find which file contains this class
              const sourceAnalyzer = analyzer.classes.has(className)
                ? analyzer
                : analyzer
                    .getIncludedAnalyzers()
                    .find((a) => a.classes.has(className));

              if (sourceAnalyzer) {
                const uri = analyzer.classes.has(className)
                  ? document.uri
                  : Array.from(documentAnalyzers.entries()).find(
                      ([, a]) => a === sourceAnalyzer
                    )?.[0];

                if (uri) {
                  const line = method.line - 1;
                  return new vscode.Location(
                    typeof uri === "string" ? vscode.Uri.parse(uri) : uri,
                    new vscode.Position(line, 0)
                  );
                }
              }
            }
          }
        }

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
        analyzeDocument(document);

        // Get relative path
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
          document.uri
        );
        const relativePath = workspaceFolder
          ? vscode.workspace.asRelativePath(document.uri, false)
          : document.fileName;

        const content = document.getText();

        console.log(`LeekScript file saved: ${relativePath}`);

        /*
        Commented until I make up my mind about this feature
        // Make POST request to localhost:8080/code-save
        try {
          const response = await fetch("http://localhost:8080/code-save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code: content,
              path: relativePath,
              upperCodeFile: "test",
            }),
          });

          if (response.ok) {
            console.log(`Successfully sent code to server: ${relativePath}`);
          } else {
            console.error(
              `Failed to send code to server: ${response.status} ${response.statusText}`
            );
          }
        } catch (error) {
          console.error(`Error sending code to server: ${error}`);
        }
        */
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
  vscode.workspace.textDocuments.forEach((document) => {
    if (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    ) {
      analyzeDocument(document);
    }
  });

  // Register document open listener
  const openListener = vscode.workspace.onDidOpenTextDocument((document) => {
    if (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    ) {
      analyzeDocument(document);
    }
  });

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
      const timer = setTimeout(() => {
        analyzeDocument(document);
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

    // Clean up analyzer and diagnostics
    if (documentAnalyzers.has(uri)) {
      documentAnalyzers.delete(uri);
      diagnosticCollection.delete(document.uri);
    }
  });

  context.subscriptions.push(closeListener);
}

export function deactivate() {
  console.log("LeekScript extension is now deactivated");
  documentAnalyzers.clear();
  if (diagnosticCollection) {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
  }
}
