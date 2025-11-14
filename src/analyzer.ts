import * as vscode from "vscode";
import {
  Parser,
  SemanticAnalyzer as TSSemanticAnalyzer,
  Program,
} from "../leekscript-ts/dist";

export interface LeekScriptFunction {
  label: string;
  fullName: string;
  insertText: string;
  argumentCount: number;
  arguments: string[];
  argumentTypes: string[];
  returnType: string;
  line: number;
  javadoc: {
    name: string;
    description: string;
    items: Array<{
      type: string;
      name?: string;
      text?: string;
      lstype?: { name: string };
    }>;
  };
}

export interface LeekScriptClass {
  label: string;
  fullName: string;
  line: number;
  javadoc: {
    name: string;
    description: string;
    items: any[];
  };
  fields: LeekScriptField[];
  staticFields: LeekScriptField[];
  methods: LeekScriptMethod[];
  staticMethods: LeekScriptMethod[];
}

export interface LeekScriptField {
  label: string;
  fullName: string;
  line: number;
  isStatic: boolean;
  type: string;
  javadoc: {
    name: string;
    description: string;
    items: any[];
    lstype?: { name: string };
  };
}

export interface LeekScriptMethod {
  label: string;
  fullName: string;
  insertText: string;
  argumentCount: number;
  arguments: string[];
  argumentTypes: string[];
  returnType: string;
  line: number;
  isStatic: boolean;
  javadoc: {
    name: string;
    description: string;
    items: Array<{
      type: string;
      name?: string;
      text?: string;
      lstype?: { name: string };
    }>;
  };
}

export interface LeekScriptGlobal {
  label: string;
  fullName: string;
  line: number;
  javadoc: {
    name: string;
    description: string;
    items: any[];
  };
}

export interface LeekScriptProblem {
  line: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

export class LeekScriptAnalyzer {
  private code: string;
  private name: string;
  private comments: Map<number, string>;
  private builtInFunctions: Set<string> = new Set();
  private includedAnalyzers: LeekScriptAnalyzer[] = [];
  private variableTypes: Map<string, string> = new Map();

  public functions: LeekScriptFunction[] = [];
  public classes: Map<string, LeekScriptClass> = new Map();
  public globals: Map<string, LeekScriptGlobal> = new Map();
  public includes: string[] = [];
  public problems: LeekScriptProblem[] = [];
  public errors: number = 0;
  public warnings: number = 0;
  public todos: number = 0;

  constructor(code: string, name: string, builtInFunctions?: Set<string>) {
    this.code = code;
    this.name = name;
    this.comments = new Map();
    if (builtInFunctions) {
      this.builtInFunctions = builtInFunctions;
    }
  }

  public setIncludedAnalyzers(analyzers: LeekScriptAnalyzer[]): void {
    this.includedAnalyzers = analyzers;
  }

  public getIncludedAnalyzers(): LeekScriptAnalyzer[] {
    return this.includedAnalyzers;
  }

  public getVariableType(name: string): string | undefined {
    return this.variableTypes.get(name);
  }

  public getAllVariableTypes(): Map<string, string> {
    return new Map(this.variableTypes);
  }

  public async analyze(): Promise<void> {
    // Clear previous results
    this.functions = [];
    this.classes = new Map();
    this.globals = new Map();
    this.includes = [];
    this.problems = [];
    this.errors = 0;
    this.warnings = 0;
    this.todos = 0;

    // Run comment extraction (for TODO counting)
    this.updateComments();

    // Use the new Compiler
    try {
      const { Compiler } = await import("./compiler/Compiler");
      const { AnalyzeErrorLevel } = await import("./compiler/ErrorSystem");
      const { formatErrorMessage } = await import("./compiler/ErrorMessages");

      // Create a mock Folder for resolving includes
      const folder: any = {
        path: "/",
        getAIs: () => [],
        resolve: (path: string) => {
          // Try to find included file from workspace
          // For now, return null (includes not yet supported in VSCode)
          return null;
        },
      };

      // Create AIFile
      const aiFile: any = {
        id: 1,
        path: this.name,
        code: this.code,
        version: 2, // LeekScript version 2
        owner: 0,
        folder: folder,
        timestamp: Date.now(),
        strict: false,
        clearErrors: () => {},
        setTokenStream: (tokens: any) => {},
      };

      // Compile
      const compiler = new Compiler();
      const result = await compiler.analyze(aiFile, 2);

      // Convert AnalyzeErrors to problems
      for (const error of result.informations) {
        const severity =
          error.level === AnalyzeErrorLevel.ERROR
            ? vscode.DiagnosticSeverity.Error
            : error.level === AnalyzeErrorLevel.WARNING
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

        this.problems.push({
          line: error.location.startLine,
          message: formatErrorMessage(error.errorType, error.parameters),
          severity,
        });

        if (severity === vscode.DiagnosticSeverity.Error) {
          this.errors++;
        } else if (severity === vscode.DiagnosticSeverity.Warning) {
          this.warnings++;
        }
      }

      // Extract symbols from compiler for autocomplete
      // TODO: Extract functions, classes, globals from SymbolTable
    } catch (error: any) {
      // Parse error - report it
      const errorMessage = error.message || "Parse error";
      const line = error.line || 1;
      this.problems.push({
        line,
        message: errorMessage,
        severity: vscode.DiagnosticSeverity.Error,
      });
      this.errors++;
    }
  }

  private extractFromAST(ast: Program): void {
    // TODO: Implement proper AST walking to extract:
    // - Functions (from FunctionDeclaration nodes)
    // - Classes (from ClassDeclaration nodes)
    // - Global variables (from global VariableDeclaration nodes)
    // - Includes (from include CallExpression nodes)
    // - Variable types (from VariableDeclaration nodes with type annotations)
    // For now, this is a placeholder.
    // The semantic analyzer already validates the code structure.
  }

  private updateComments(): void {
    this.comments.clear();
    this.todos = 0;

    // Extract /* */ style comments for TODO counting
    const blockCommentRegex = /\/\*([^]*?)\*\//gm;
    let match;

    while ((match = blockCommentRegex.exec(this.code)) !== null) {
      const commentText = match[1].trim();
      this.comments.set(match.index, commentText);

      // Check for TODOs
      if (commentText.toLowerCase().includes("todo")) {
        this.todos++;
      }
    }

    // Extract // style comments
    const lineCommentRegex = /\/\/.*$/gm;
    while ((match = lineCommentRegex.exec(this.code)) !== null) {
      const commentText = match[0].substring(2).trim();
      this.comments.set(match.index, commentText);

      // Check for TODOs
      if (commentText.toLowerCase().includes("todo")) {
        this.todos++;
      }
    }
  }

  public getAllAvailableFunctions(): LeekScriptFunction[] {
    const functions = [...this.functions];

    // Add functions from included files
    for (const includedAnalyzer of this.includedAnalyzers) {
      functions.push(...includedAnalyzer.functions);
    }

    return functions;
  }

  public getAllAvailableClasses(): Map<string, LeekScriptClass> {
    const classes = new Map(this.classes);

    // Add classes from included files
    for (const includedAnalyzer of this.includedAnalyzers) {
      for (const [name, clazz] of includedAnalyzer.classes) {
        if (!classes.has(name)) {
          classes.set(name, clazz);
        }
      }
    }

    return classes;
  }

  public getAllAvailableGlobals(): Map<string, LeekScriptGlobal> {
    const globals = new Map(this.globals);

    // Add globals from included files
    for (const includedAnalyzer of this.includedAnalyzers) {
      for (const [name, global] of includedAnalyzer.globals) {
        if (!globals.has(name)) {
          globals.set(name, global);
        }
      }
    }

    return globals;
  }
}
