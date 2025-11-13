import * as vscode from "vscode";

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
  private comments: Map<number, string>; // Map of position to comment
  private commentRanges: Array<{ start: number; end: number }>; // Ranges of all comments
  private stringRanges: Array<{ start: number; end: number }>; // Ranges of all string literals
  private builtInFunctions: Set<string> = new Set(); // Will be populated from extension
  private includedAnalyzers: LeekScriptAnalyzer[] = []; // Analyzers for included files
  private variableTypes: Map<string, string> = new Map(); // Track variable types

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
    this.commentRanges = [];
    this.stringRanges = [];
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

  public analyze(): void {
    // Clear previous results
    this.functions = [];
    this.classes = new Map();
    this.globals = new Map();
    this.includes = [];
    this.problems = [];
    this.errors = 0;
    this.warnings = 0;
    this.todos = 0;

    // Run analysis
    this.updateComments();
    this.updateStringLiterals();
    this.updateIncludes();
    this.updateFunctions();
    this.updateClasses();
    this.updateGlobalVars();
    this.updateVariableTypes();
    this.checkUndefinedFunctions();
  }

  private updateComments(): void {
    this.comments.clear();
    this.commentRanges = [];
    this.todos = 0;

    // Extract /* */ style comments
    const blockCommentRegex = /\/\*([^]*?)\*\//gm;
    let match;

    while ((match = blockCommentRegex.exec(this.code)) !== null) {
      // Store comment at the position where it starts
      const commentText = match[1].trim();
      this.comments.set(match.index, commentText);

      // Track the range of this comment
      this.commentRanges.push({
        start: match.index,
        end: match.index + match[0].length,
      });

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

      // Track the range of this comment
      this.commentRanges.push({
        start: match.index,
        end: match.index + match[0].length,
      });

      // Check for TODOs
      if (commentText.toLowerCase().includes("todo")) {
        this.todos++;
      }
    }
  }

  private updateStringLiterals(): void {
    this.stringRanges = [];

    // Track both single and double quoted strings
    // We need to be careful about escaped quotes
    let i = 0;
    while (i < this.code.length) {
      const char = this.code[i];

      // Check if we're starting a string literal
      if (char === '"' || char === "'") {
        const quoteChar = char;
        const start = i;
        i++; // Move past opening quote

        // Find the closing quote, handling escaped quotes
        while (i < this.code.length) {
          if (this.code[i] === "\\") {
            // Skip escaped character
            i += 2;
          } else if (this.code[i] === quoteChar) {
            // Found closing quote
            i++; // Include closing quote
            this.stringRanges.push({ start, end: i });
            break;
          } else {
            i++;
          }
        }
      } else {
        i++;
      }
    }
  }

  private isPositionInComment(position: number): boolean {
    return this.commentRanges.some(
      (range) => position >= range.start && position < range.end
    );
  }

  private isPositionInString(position: number): boolean {
    return this.stringRanges.some(
      (range) => position >= range.start && position < range.end
    );
  }

  private updateIncludes(): void {
    this.includes = [];

    // Detect include() statements
    const includeRegex = /include\s*\(\s*["'](.*?)["']\s*\)/gm;
    let match;

    while ((match = includeRegex.exec(this.code)) !== null) {
      const includePath = match[1];
      this.includes.push(includePath);
    }
  }

  private parseArguments(allArguments: string): {
    args: string[];
    types: string[];
  } {
    const args: string[] = [];
    const types: string[] = [];

    if (!allArguments || allArguments.trim() === "") {
      return { args, types };
    }

    let chevron = 0;
    let j = 0;

    for (let i = 0; i <= allArguments.length; i++) {
      const c = i < allArguments.length ? allArguments[i] : ",";
      if (c === "<") chevron++;
      if (c === ">") chevron--;
      if (chevron === 0 && c === ",") {
        let arg = allArguments.substring(j, i).trim();
        j = i + 1;

        if (arg.startsWith("@")) {
          arg = arg.substring(1);
        }

        if (arg.includes(" ")) {
          const space = arg.lastIndexOf(" ");
          types.push(arg.substring(0, space));
          arg = arg.substring(space + 1);
        } else {
          types.push("any");
        }
        args.push(arg);
      }
    }

    return { args, types };
  }

  private updateFunctions(): void {
    this.functions = [];

    const functionRegex =
      /function\s+(\w+)\s*\(([^]*?)\)\s*(?:=>)?(?:->)?\s*(.*)\s*{/gm;
    let match;

    while ((match = functionRegex.exec(this.code)) !== null) {
      const line = this.code.substring(0, match.index).split("\n").length;
      const returnType = match[3] ? match[3].trim() : "any";

      const { args, types } = this.parseArguments(match[2]);

      const fullName = match[1] + "(" + args.join(", ") + ")";

      // Get comment if exists
      const comment = this.comments.get(match.index);
      const javadoc = {
        name: match[1],
        description: "",
        items: [] as any[],
      };

      // Add arguments from signature
      for (let a = 0; a < args.length; a++) {
        javadoc.items.push({
          type: "param",
          name: args[a],
          text: null,
          lstype: { name: types[a] },
        });
      }

      // Parse javadoc if comment exists
      if (comment) {
        this.parseJavadoc(comment, javadoc, args);
      }

      const fun: LeekScriptFunction = {
        label: match[1],
        fullName,
        insertText:
          match[1] +
          "(" +
          args.map((a, i) => `\${${i + 1}:${a}}`).join(", ") +
          ")",
        argumentCount: args.length,
        arguments: args,
        argumentTypes: types,
        returnType,
        line,
        javadoc,
      };

      this.functions.push(fun);
    }
  }

  private updateClasses(): void {
    this.classes.clear();

    // Find all class declarations
    const classRegex = /class\s+(\w+)\s*(extends|{)/gm;
    let match;

    while ((match = classRegex.exec(this.code)) !== null) {
      const line = this.code.substring(0, match.index).split("\n").length;
      const name = match[1];
      const comment = this.comments.get(match.index);
      const javadoc = { name, description: comment || "", items: [] };

      const classInfo: LeekScriptClass = {
        label: name,
        fullName: name,
        line,
        javadoc,
        fields: [],
        staticFields: [],
        methods: [],
        staticMethods: [],
      };

      this.classes.set(name, classInfo);
    }

    // Find fields within classes
    const fieldRegex =
      /^\s*(?:public\s+)?(?:(static)\s+)?([\w ,<>]+[ \t]+)?(\w+)[ \t]*($|=|;)/gm;
    while ((match = fieldRegex.exec(this.code)) !== null) {
      const name = match[3];
      if (
        name === "function" ||
        name === "for" ||
        name === "while" ||
        name === "if"
      ) {
        continue;
      }

      const isStatic = !!match[1];
      const type = match[2] || "any";
      const line = this.code.substring(0, match.index).split("\n").length;

      const comment =
        this.comments.get(match.index) || this.comments.get(match.index + 1);
      const javadoc = {
        name,
        description: comment || "",
        items: [] as any[],
        lstype: { name: type },
      };

      // Find which class this field belongs to
      let ownerClass: LeekScriptClass | null = null;
      for (const [, clazz] of this.classes) {
        if (clazz.line > line) break;
        ownerClass = clazz;
      }

      if (ownerClass) {
        const field: LeekScriptField = {
          label: name,
          fullName: name,
          line,
          isStatic,
          type,
          javadoc,
        };

        if (isStatic) {
          ownerClass.staticFields.push(field);
        } else {
          ownerClass.fields.push(field);
        }
      }
    }

    // Find methods within classes
    const methodRegex =
      /^\s*(?:public\s+)?(?:(static)\s+)?(.*\s+?)?(\w+)\s*\(([\w\s,<>]*)\)\s*{/gm;
    while ((match = methodRegex.exec(this.code)) !== null) {
      const name = match[3];
      if (
        name === "function" ||
        name === "for" ||
        name === "while" ||
        name === "if"
      ) {
        continue;
      }

      const isStatic = !!match[1];
      const returnType = match[2] ? match[2].trim() : "any";
      const line = this.code.substring(0, match.index).split("\n").length;

      const { args, types } = this.parseArguments(match[4]);

      const fullName = name + "(" + args.join(", ") + ")";

      const comment =
        this.comments.get(match.index) || this.comments.get(match.index + 1);
      const javadoc = {
        name,
        description: "",
        items: [] as any[],
      };

      // Add arguments from signature
      for (let a = 0; a < args.length; a++) {
        javadoc.items.push({
          type: "param",
          name: args[a],
          text: null,
          lstype: { name: types[a] },
        });
      }

      if (comment) {
        this.parseJavadoc(comment, javadoc, args);
      }

      // Find which class this method belongs to
      let ownerClass: LeekScriptClass | null = null;
      for (const [, clazz] of this.classes) {
        if (clazz.line > line) break;
        ownerClass = clazz;
      }

      if (ownerClass) {
        const method: LeekScriptMethod = {
          label: name,
          fullName,
          insertText:
            name +
            "(" +
            args.map((a, i) => `\${${i + 1}:${a}}`).join(", ") +
            ")",
          argumentCount: args.length,
          arguments: args,
          argumentTypes: types,
          returnType,
          line,
          isStatic,
          javadoc,
        };

        if (isStatic) {
          ownerClass.staticMethods.push(method);
        } else {
          ownerClass.methods.push(method);
        }
      }
    }
  }

  private updateGlobalVars(): void {
    this.globals.clear();

    const globalRegex = /global\s+(?:.*\s+?)?(\w+)$/gm;
    let match;

    while ((match = globalRegex.exec(this.code)) !== null) {
      const line = this.code.substring(0, match.index).split("\n").length;
      const name = match[1];
      const comment = this.comments.get(match.index);
      const javadoc = { name, description: comment || "", items: [] };

      this.globals.set(name, {
        label: name,
        fullName: name,
        line,
        javadoc,
      });
    }
  }

  private updateVariableTypes(): void {
    this.variableTypes.clear();

    // Create a version of code with comments and strings replaced by spaces
    // This preserves positions while removing content we want to ignore
    let cleanCode = this.code;

    // Replace all comment ranges with spaces
    const sortedComments = [...this.commentRanges].sort(
      (a, b) => b.start - a.start
    );
    for (const range of sortedComments) {
      cleanCode =
        cleanCode.substring(0, range.start) +
        " ".repeat(range.end - range.start) +
        cleanCode.substring(range.end);
    }

    // Replace all string ranges with spaces
    const sortedStrings = [...this.stringRanges].sort(
      (a, b) => b.start - a.start
    );
    for (const range of sortedStrings) {
      cleanCode =
        cleanCode.substring(0, range.start) +
        " ".repeat(range.end - range.start) +
        cleanCode.substring(range.end);
    }

    // Match variable declarations with built-in types: "type varName" or "var varName"
    // Examples: "integer count", "string name", "var x"
    const varDeclRegex =
      /\b(integer|real|number|string|boolean|array|var)\s+(\w+)(?:\s*=|;|,|\s)/gm;
    let match;

    while ((match = varDeclRegex.exec(cleanCode)) !== null) {
      const type = match[1];
      const varName = match[2];
      const position = match.index;

      // Skip if it's a function parameter (inside function declaration)
      const beforeMatch = cleanCode.substring(
        Math.max(0, position - 50),
        position
      );

      // Skip if inside function signature
      if (/function\s+\w+\s*\([^)]*$/.test(beforeMatch)) {
        continue;
      }

      // Store the variable type (var becomes 'any')
      const finalType = type === "var" ? "any" : type;
      this.variableTypes.set(varName, finalType);
    }

    // Match variable declarations with class types: "ClassName varName"
    // Examples: "MyClass obj", "Test instance"
    const allClasses = this.getAllAvailableClasses();
    for (const className of allClasses.keys()) {
      const classVarRegex = new RegExp(
        `\\b${className}\\s+(\\w+)(?:\\s*=|;|,|\\s)`,
        "gm"
      );
      while ((match = classVarRegex.exec(cleanCode)) !== null) {
        const varName = match[1];
        const position = match.index;

        // Skip if it's a function parameter
        const beforeMatch = cleanCode.substring(
          Math.max(0, position - 50),
          position
        );
        if (/function\s+\w+\s*\([^)]*$/.test(beforeMatch)) {
          continue;
        }

        // Store the variable type as the class name
        this.variableTypes.set(varName, className);
      }
    }

    // Also track function parameters in their respective function scopes
    // This is a simplified approach - in reality we'd need proper scope tracking
    this.functions.forEach((func) => {
      func.arguments.forEach((argName, index) => {
        const argType = func.argumentTypes[index];
        this.variableTypes.set(argName, argType);
      });
    });

    // Track method parameters (including constructors)
    for (const [, clazz] of this.classes) {
      // Track all methods (instance and static)
      [...clazz.methods, ...clazz.staticMethods].forEach((method) => {
        method.arguments.forEach((argName, index) => {
          const argType = method.argumentTypes[index];
          this.variableTypes.set(argName, argType);
        });
      });
    }

    // Track global variables with their types
    const globalTypedRegex =
      /global\s+(integer|real|number|string|boolean|array)\s+(\w+)/gm;
    while ((match = globalTypedRegex.exec(this.code)) !== null) {
      const type = match[1];
      const varName = match[2];
      const position = match.index;

      // Skip if position is inside a comment
      if (this.isPositionInComment(position)) {
        continue;
      }

      // Skip if position is inside a string literal
      if (this.isPositionInString(position)) {
        continue;
      }

      this.variableTypes.set(varName, type);
    }
  }

  private parseJavadoc(comment: string, javadoc: any, args: string[]): void {
    const lines = comment.split("\n");
    const javadocRegex =
      /^\s*@(\w+)(?:\s+([a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)\s*:?\s*)?(?:\s*:\s*)?(.*)$/;

    for (const jline of lines) {
      const match = javadocRegex.exec(jline);
      if (match) {
        const type = match[1];
        let name = match[2];
        let text = match[3];

        if (type === "return") {
          javadoc.items.push({ type, name, text });
        } else if (type === "param") {
          if (name) {
            name = name.trim();
            if (name.startsWith("@")) {
              name = name.substring(1);
            }
          }
          text = text.trim();
          if (text.startsWith("@")) {
            text = text.trim().substring(1);
          }

          if (args.includes(name) || args.includes(text)) {
            const existing = javadoc.items.find(
              (i: any) =>
                i.type === "param" &&
                ((name && name.length && i.name === name) ||
                  (text && text.length && i.name === text))
            );
            if (existing) {
              existing.text = text;
              continue;
            }
          }
          javadoc.items.push({ type, name, text });
        } else {
          javadoc.items.push({ type, name, text });
        }
      } else {
        if (jline.length) {
          if (javadoc.description.length) {
            javadoc.description += "\n";
          }
          javadoc.description += jline;
        }
      }
    }
  }

  private checkUndefinedFunctions(): void {
    // Regex to find function calls: functionName(...)
    // Must not be preceded by keywords like 'function', 'return', etc.
    const functionCallRegex = /\b(\w+)\s*\(/gm;
    let match;

    while ((match = functionCallRegex.exec(this.code)) !== null) {
      const functionName = match[1];
      const position = match.index;
      const line = this.code.substring(0, position).split("\n").length;

      // Skip if position is inside a comment
      if (this.isPositionInComment(position)) {
        continue;
      }

      // Skip if position is inside a string literal
      if (this.isPositionInString(position)) {
        continue;
      }

      // Skip keywords and control structures
      const keywords = [
        "if",
        "for",
        "while",
        "function",
        "constructor",
        "include",
        "return",
        "new",
        "switch",
        "case",
        "catch",
        "class",
        "extends",
      ];
      if (keywords.includes(functionName)) {
        continue;
      }

      // Check what comes before the function name to avoid false positives
      const beforeMatch = this.code.substring(
        Math.max(0, position - 20),
        position
      );

      // Skip if preceded by 'return' (e.g., "return (expression)")
      if (/return\s*$/.test(beforeMatch)) {
        continue;
      }

      // Skip if preceded by 'function' declaration
      if (/function\s+$/.test(beforeMatch)) {
        continue;
      }

      // Check if preceded by 'new' (constructor call)
      const isConstructorCall = /new\s+$/.test(beforeMatch);
      if (isConstructorCall) {
        // Validate constructor call
        this.validateConstructorCall(functionName, position, line);
        continue;
      }

      // Check if it's a class name (constructor call without 'new' keyword)
      const allClasses = this.getAllAvailableClasses();
      if (allClasses.has(functionName)) {
        // It's a constructor call without 'new' - validate it
        this.validateConstructorCall(functionName, position, line);
        continue;
      }

      // Skip if it's a method call (preceded by .)
      if (/\.\s*$/.test(beforeMatch)) {
        continue;
      }

      // Check if it's a variable or parameter in scope
      // This includes function parameters which could be function references
      if (this.isVariableInScope(functionName, position)) {
        // It's a variable, not a direct function call - skip validation
        continue;
      }

      // Check if function is defined
      const isDefined = this.isFunctionDefined(functionName);

      if (!isDefined) {
        this.problems.push({
          line,
          message: `Function '${functionName}' is not defined`,
          severity: vscode.DiagnosticSeverity.Error,
        });
        this.errors++;
      } else {
        // Validate parameter count for user-defined functions
        this.validateFunctionCall(functionName, position, line);
      }
    }
  }

  private isVariableInScope(name: string, position: number): boolean {
    // Check if it's a declared variable
    if (this.variableTypes.has(name)) {
      return true;
    }

    // Check if it's a parameter of the function we're currently in
    // Find which function contains this position
    for (const func of this.functions) {
      // Find the function's start and end in code
      const funcStart = this.code.indexOf(`function ${func.label}`);
      if (funcStart === -1) continue;

      // Find the function's closing brace (simplified - assumes proper formatting)
      let braceDepth = 0;
      let funcEnd = funcStart;
      let foundStart = false;

      for (let i = funcStart; i < this.code.length; i++) {
        if (this.code[i] === "{") {
          braceDepth++;
          foundStart = true;
        }
        if (this.code[i] === "}") {
          braceDepth--;
          if (foundStart && braceDepth === 0) {
            funcEnd = i;
            break;
          }
        }
      }

      // Check if position is within this function
      if (position >= funcStart && position <= funcEnd) {
        // Check if name is one of this function's parameters
        if (func.arguments.includes(name)) {
          return true;
        }
      }
    }

    // Check in class methods
    for (const [, clazz] of this.classes) {
      for (const method of [...clazz.methods, ...clazz.staticMethods]) {
        // Find method start
        const methodStart =
          this.code.indexOf(`function ${method.label}`) !== -1
            ? this.code.indexOf(`function ${method.label}`)
            : this.code.indexOf(`${method.label}(`);

        if (methodStart === -1) continue;

        // Find method end (simplified)
        let braceDepth = 0;
        let methodEnd = methodStart;
        let foundStart = false;

        for (let i = methodStart; i < this.code.length; i++) {
          if (this.code[i] === "{") {
            braceDepth++;
            foundStart = true;
          }
          if (this.code[i] === "}") {
            braceDepth--;
            if (foundStart && braceDepth === 0) {
              methodEnd = i;
              break;
            }
          }
        }

        // Check if position is within this method
        if (position >= methodStart && position <= methodEnd) {
          // Check if name is one of this method's parameters
          if (method.arguments.includes(name)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private validateConstructorCall(
    className: string,
    position: number,
    line: number
  ): void {
    // Check if class exists
    const allClasses = this.getAllAvailableClasses();
    const clazz = allClasses.get(className);

    if (!clazz) {
      this.problems.push({
        line,
        message: `Class '${className}' is not defined`,
        severity: vscode.DiagnosticSeverity.Error,
      });
      this.errors++;
      return;
    }

    // Find constructor in the class
    const constructor = clazz.methods.find((m) => m.label === "constructor");
    if (!constructor) {
      // No explicit constructor, check if arguments are provided
      const argCount = this.countFunctionArguments(position);
      if (argCount > 0) {
        this.problems.push({
          line,
          message: `Class '${className}' has no constructor but ${argCount} argument(s) provided`,
          severity: vscode.DiagnosticSeverity.Error,
        });
        this.errors++;
      }
      return;
    }

    // Validate argument count
    const providedArgCount = this.countFunctionArguments(position);
    const expectedArgCount = constructor.argumentCount;

    if (providedArgCount !== expectedArgCount) {
      this.problems.push({
        line,
        message: `Constructor of '${className}' expects ${expectedArgCount} argument(s) but ${providedArgCount} provided`,
        severity: vscode.DiagnosticSeverity.Error,
      });
      this.errors++;
      return; // Don't continue to type checking if count is wrong
    }

    // Validate argument types
    const providedArgs = this.extractFunctionArguments(position);
    for (let i = 0; i < providedArgs.length; i++) {
      const providedArg = providedArgs[i];
      const expectedType = constructor.argumentTypes[i];

      if (expectedType && expectedType !== "any") {
        const inferredType = this.inferExpressionType(providedArg);
        if (
          inferredType &&
          inferredType !== "any" &&
          !this.isTypeCompatible(inferredType, expectedType)
        ) {
          this.problems.push({
            line,
            message: `Argument ${
              i + 1
            } of constructor '${className}': expected '${expectedType}' but got '${inferredType}'`,
            severity: vscode.DiagnosticSeverity.Error,
          });
          this.errors++;
        }
      }
    }
  }

  private validateFunctionCall(
    functionName: string,
    position: number,
    line: number
  ): void {
    // Find the function definition
    let func: LeekScriptFunction | undefined;

    // Check in current file
    func = this.functions.find((f) => f.label === functionName);

    // Check in included files
    if (!func) {
      for (const includedAnalyzer of this.includedAnalyzers) {
        func = includedAnalyzer.functions.find((f) => f.label === functionName);
        if (func) break;
      }
    }

    // If it's a user-defined function, validate argument count
    if (func) {
      const providedArgCount = this.countFunctionArguments(position);
      const expectedArgCount = func.argumentCount;

      if (providedArgCount !== expectedArgCount) {
        this.problems.push({
          line,
          message: `Function '${functionName}' expects ${expectedArgCount} argument(s) but ${providedArgCount} provided`,
          severity: vscode.DiagnosticSeverity.Error,
        });
        this.errors++;
        return; // Don't continue to type checking if count is wrong
      }

      // Validate argument types
      const providedArgs = this.extractFunctionArguments(position);
      for (let i = 0; i < providedArgs.length; i++) {
        const providedArg = providedArgs[i];
        const expectedType = func.argumentTypes[i];

        if (expectedType && expectedType !== "any") {
          const inferredType = this.inferExpressionType(providedArg);
          if (
            inferredType &&
            inferredType !== "any" &&
            !this.isTypeCompatible(inferredType, expectedType)
          ) {
            this.problems.push({
              line,
              message: `Argument ${
                i + 1
              } of function '${functionName}': expected '${expectedType}' but got '${inferredType}'`,
              severity: vscode.DiagnosticSeverity.Error,
            });
            this.errors++;
          }
        }
      }
    }
    // Note: We don't validate built-in functions as we don't have their full signatures
  }

  private countFunctionArguments(position: number): number {
    // Find the matching closing parenthesis
    let depth = 0;
    let start = position;

    // Find the opening parenthesis
    while (start < this.code.length && this.code[start] !== "(") {
      start++;
    }

    if (start >= this.code.length) {
      return 0;
    }

    start++; // Move past the opening '('
    const argsStart = start;

    // Find the matching closing parenthesis
    let end = start;
    depth = 1;
    while (end < this.code.length && depth > 0) {
      if (this.code[end] === "(") depth++;
      if (this.code[end] === ")") depth--;
      if (depth > 0) end++;
    }

    const argsString = this.code.substring(argsStart, end).trim();

    // Empty arguments
    if (argsString === "") {
      return 0;
    }

    // Count commas at depth 0 (not inside nested parentheses or brackets)
    let argCount = 1; // At least one argument if string is not empty
    depth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "[") bracketDepth++;
      if (char === "]") bracketDepth--;
      if (char === "," && depth === 0 && bracketDepth === 0) {
        argCount++;
      }
    }

    return argCount;
  }

  private isFunctionDefined(name: string): boolean {
    // Check built-in functions
    if (this.builtInFunctions.has(name)) {
      return true;
    }

    // Check user-defined functions in current file
    if (this.functions.find((f) => f.label === name)) {
      return true;
    }

    // Check methods in user-defined classes
    for (const [, clazz] of this.classes) {
      if (clazz.methods.find((m) => m.label === name)) {
        return true;
      }
      if (clazz.staticMethods.find((m) => m.label === name)) {
        return true;
      }
    }

    // Check in included files
    for (const includedAnalyzer of this.includedAnalyzers) {
      if (includedAnalyzer.functions.find((f) => f.label === name)) {
        return true;
      }
      // Also check classes in included files
      for (const [, clazz] of includedAnalyzer.classes) {
        if (clazz.methods.find((m) => m.label === name)) {
          return true;
        }
        if (clazz.staticMethods.find((m) => m.label === name)) {
          return true;
        }
      }
    }

    return false;
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

  private extractFunctionArguments(position: number): string[] {
    // Find the matching closing parenthesis
    let start = position;

    // Find the opening parenthesis
    while (start < this.code.length && this.code[start] !== "(") {
      start++;
    }

    if (start >= this.code.length) {
      return [];
    }

    start++; // Move past the opening '('
    const argsStart = start;

    // Find the matching closing parenthesis
    let end = start;
    let depth = 1;
    while (end < this.code.length && depth > 0) {
      if (this.code[end] === "(") depth++;
      if (this.code[end] === ")") depth--;
      if (depth > 0) end++;
    }

    const argsString = this.code.substring(argsStart, end).trim();

    // Empty arguments
    if (argsString === "") {
      return [];
    }

    // Split arguments at commas (but not inside nested parentheses/brackets)
    const args: string[] = [];
    depth = 0;
    let bracketDepth = 0;
    let currentArg = "";

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "[") bracketDepth++;
      if (char === "]") bracketDepth--;

      if (char === "," && depth === 0 && bracketDepth === 0) {
        args.push(currentArg.trim());
        currentArg = "";
      } else {
        currentArg += char;
      }
    }

    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }

    return args;
  }

  private inferExpressionType(expr: string): string {
    expr = expr.trim();

    // String literals
    if (
      (expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))
    ) {
      return "string";
    }

    // Number literals
    if (/^-?\d+$/.test(expr)) {
      return "integer";
    }
    if (/^-?\d+\.\d+$/.test(expr)) {
      return "real";
    }

    // Boolean literals
    if (expr === "true" || expr === "false") {
      return "boolean";
    }

    // Null
    if (expr === "null") {
      return "any";
    }

    // Array literals
    if (expr.startsWith("[") && expr.endsWith("]")) {
      return "array";
    }

    // New expression
    if (expr.startsWith("new ")) {
      const className = expr.substring(4).match(/^\w+/)?.[0];
      if (className) {
        return className;
      }
    }

    // Variable reference - try to find its type
    if (/^\w+$/.test(expr)) {
      // Check in tracked variable types
      const varType = this.variableTypes.get(expr);
      if (varType) {
        return varType;
      }

      // Check if it's a global variable
      const global = this.globals.get(expr);
      if (global) {
        // Check if we have type info for this global
        const globalType = this.variableTypes.get(expr);
        if (globalType) {
          return globalType;
        }
        return "any";
      }

      // Check if it's a function call result
      const func = this.functions.find((f) => f.label === expr);
      if (func) {
        return func.returnType;
      }
    }

    // Function call
    const funcCallMatch = expr.match(/^(\w+)\s*\(/);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1];

      // Check if it's a class constructor (with or without 'new')
      const allClasses = this.getAllAvailableClasses();
      if (allClasses.has(funcName)) {
        return funcName;
      }

      const func = this.functions.find((f) => f.label === funcName);
      if (func) {
        return func.returnType;
      }

      // Check included files
      for (const includedAnalyzer of this.includedAnalyzers) {
        const includedFunc = includedAnalyzer.functions.find(
          (f) => f.label === funcName
        );
        if (includedFunc) {
          return includedFunc.returnType;
        }
      }
    }

    // String concatenation with + operator
    // Check if expression contains string literals or string variables
    if (expr.includes("+")) {
      // Check if any part is a string literal
      if (expr.includes('"') || expr.includes("'")) {
        return "string";
      }

      // Check if any variable in the expression is of type string
      const identifiers = expr.match(/\b[a-zA-Z_]\w*\b/g) || [];
      for (const identifier of identifiers) {
        const varType = this.variableTypes.get(identifier);
        if (varType === "string") {
          return "string";
        }
      }
    }

    // Arithmetic operations return number
    if (/[+\-*/%]/.test(expr)) {
      return "number";
    }

    // Comparison operations return boolean
    if (/[<>!=]=?|===|!==/.test(expr)) {
      return "boolean";
    }

    // Default to any
    return "any";
  }

  private isTypeCompatible(
    providedType: string,
    expectedType: string
  ): boolean {
    // Exact match
    if (providedType === expectedType) {
      return true;
    }

    // Any is compatible with everything
    if (providedType === "any" || expectedType === "any") {
      return true;
    }

    // Number is a supertype of integer and real
    if (
      expectedType === "number" &&
      (providedType === "integer" || providedType === "real")
    ) {
      return true;
    }

    // Real can accept integer
    if (expectedType === "real" && providedType === "integer") {
      return true;
    }

    // Class inheritance (would need more analysis)
    // For now, we just check exact match

    return false;
  }
}
