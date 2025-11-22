import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../../services/analyzer/definitions.types";

export class DefinitionManager {
  private static instance: DefinitionManager | null = null;

  public extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }
  // User defined data
  private userFunctions: UserFunction[] = [];
  private userClasses: UserClass[] = [];
  private userVariables: UserVariable[] = [];

  /**
   * Get the singleton instance
   */
  public static getInstance(extensionPath: string): DefinitionManager {
    if (!DefinitionManager.instance) {
      DefinitionManager.instance = new DefinitionManager(extensionPath);
    }
    return DefinitionManager.instance;
  }

  /**
   * Set user defined functions
   */
  public setUserDefinedFunctions(functions: UserFunction[]): void {
    this.userFunctions = functions;
  }

  /**
   * Get user defined functions
   */
  public getUserDefinedFunctions(): UserFunction[] {
    return this.userFunctions;
  }

  /**
   * Find a user defined function by name
   */
  public findUserDefinedFunction(name: string): UserFunction | null {
    for (const func of this.userFunctions) {
      if (func.name === name) {
        return func;
      }
    }
    return null;
  }

  /**
   * Remove all user defined functions
   */
  public clearUserDefinedFunctions(): void {
    this.userFunctions = [];
  }

  /**
   * Set user defined classes
   */
  public setUserDefinedClasses(classes: UserClass[]): void {
    this.userClasses = classes;
  }

  /**
   * Get user defined classes
   */
  public getUserDefinedClasses(): UserClass[] {
    return this.userClasses;
  }

  /**
   * Find a user defined class by name
   */
  public findUserDefinedClass(name: string): UserClass | null {
    for (const cls of this.userClasses) {
      if (cls.name === name) {
        return cls;
      }
    }
    return null;
  }

  /**
   * Remove all user defined classes
   */
  public clearUserDefinedClasses(): void {
    this.userClasses = [];
  }

  /**
   * Set user defined variables
   */
  public setUserDefinedVariables(variables: UserVariable[]): void {
    this.userVariables = variables;
  }

  /**
   * get user defined variables
   */
  public getUserDefinedVariables(): UserVariable[] {
    return this.userVariables;
  }

  /**
   * Find a user defined variable by name
   */
  public findUserDefinedVariable(name: string): UserVariable | null {
    for (const variable of this.userVariables) {
      if (variable.name === name) {
        return variable;
      }
    }
    return null;
  }

  /**
   * Remove all user defined variables
   */
  public clearUserDefinedVariables(): void {
    this.userVariables = [];
  }
}
