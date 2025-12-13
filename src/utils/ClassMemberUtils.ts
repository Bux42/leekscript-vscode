import * as vscode from "vscode";
import { DefinitionManager } from "../providers/user-code/DefinitionManager";
import {
  UserClass,
  UserFunction,
  UserVariable,
} from "../services/analyzer/definitions.types";

export interface ResolvedMember {
  method?: UserFunction;
  field?: UserVariable;
}

/**
 * Given a member access chain, resolve the class of the last member, or an array of all parent classes in the hierarchy
 * @param memberParts
 * @param definitionProvider
 * @returns The class of the last member, or an array of parent classes, starting from the immediate parent up to the topmost ancestor
 */
export const resolveMemberClass = (
  memberParts: string[],
  definitionProvider: DefinitionManager
): UserClass[] => {
  const parentClasses: UserClass[] = [];

  let word = memberParts.shift() || "";
  console.log(
    "Resolving members for parts:",
    memberParts,
    " starting with word:",
    word
  );

  // Check if it's a user variable
  let userVariable = definitionProvider.findUserDefinedVariable(word);

  let userClass: UserClass | null = null;

  if (memberParts.length === 0) {
    //check user class
    userClass = definitionProvider.findUserDefinedClass(word);
    if (userClass) {
      console.log(
        `Found class class '${userClass.name}' for variable '${word}', collecting parent classes.`
      );
      parentClasses.push(userClass);
      while (userClass.parentName) {
        const parentClass = definitionProvider.findUserDefinedClass(
          userClass.parentName
        );
        if (parentClass) {
          console.log(
            `Found parent class '${parentClass.name}' of '${userClass.name}'.`
          );
          parentClasses.push(parentClass);
          userClass = parentClass;
        } else {
          break;
        }
      }
      return parentClasses;
    }
  }

  if (!userVariable) {
    console.log(
      `Cannot resolve member access for part '${word}', stopping traversal.`
    );
    return parentClasses;
  }

  const userVariableType = userVariable.type;
  userClass = definitionProvider.findUserDefinedClass(userVariableType);

  if (!userClass) {
    console.log(
      `Type '${userVariableType}' of variable '${userVariable.name}' is not a user-defined class, stopping traversal.`
    );
    return parentClasses;
  }

  parentClasses.push(userClass);

  while (userClass.parentName) {
    const parentClass = definitionProvider.findUserDefinedClass(
      userClass.parentName
    );
    if (parentClass) {
      console.log(
        `Found parent class '${parentClass.name}' of '${userClass.name}'.`
      );
      parentClasses.push(parentClass);
      userClass = parentClass;
    } else {
      break;
    }
  }

  if (parentClasses.length === 1) {
    console.log(
      "Current class does not extend any other class, classic resolve only."
    );
    while (memberParts.length > 0) {
      word = memberParts.shift() || "";

      console.log("LOOP: Resolving member definition for word:", word);

      // check class members (fields & methods)
      const classField = userClass.fields.find((field) => field.name === word);

      if (!classField) {
        console.log(
          `Member '${word}' not found in class '${userClass.name}', stopping traversal.`
        );
        return parentClasses;
      } else {
        // Found field, get its type
        const fieldType = classField.type;
        userClass = definitionProvider.findUserDefinedClass(fieldType);
        if (!userClass) {
          console.log(
            `Type '${fieldType}' of field '${classField.name}' is not a user-defined class, stopping traversal.`
          );
          return parentClasses;
        }
        return [userClass];
      }
    }
  }

  return parentClasses;
};

/**
 * Given a member access chain, resolve to the final member definition
 * @param memberParts
 * @param definitionProvider
 * @returns The resolved member (method or field), or null if not found
 */
export const resolveMembers = (
  memberParts: string[],
  definitionProvider: DefinitionManager
): ResolvedMember | null => {
  let word = memberParts.shift() || "";
  console.log(
    "Resolving members for parts:",
    memberParts,
    " starting with word:",
    word
  );

  // Check if it's a user variable
  let userVariable = definitionProvider.findUserDefinedVariable(word);

  // check class static member access
  let userClass = definitionProvider.findUserDefinedClass(word);

  if (userClass) {
    console.log(
      `Found class class '${userClass.name}' for variable '${word}', check static members.`
    );
    word = memberParts.shift() || "";
    // Check if the member is a field
    const classStaticField = userClass.fields.find(
      (field) => field.name === word && field.isStatic
    );

    if (classStaticField) {
      console.log(
        `Found static field '${classStaticField.name}' of class '${userClass.name}', continuing traversal.`
      );

      if (memberParts.length === 0) {
        // Last part, return definition
        return { field: classStaticField };
      }
    }
    // Check if the member is a method
    const classStaticMethod = userClass.methods.find(
      (method) => method.name === word && method.isStatic
    );
    if (classStaticMethod) {
      console.log(
        `Found static method '${classStaticMethod.name}' of class '${userClass.name}', continuing traversal.`
      );

      if (memberParts.length === 0) {
        // Last part, return definition
        return { method: classStaticMethod };
      }
    }
  }

  if (!userVariable) {
    console.log(
      `Cannot resolve member access for part '${word}', stopping traversal.`
    );
    return null;
  }

  console.log("Traversing member parts of variable:", userVariable);

  userClass = null;

  while (memberParts.length > 0) {
    word = memberParts.shift() || "";

    console.log("LOOP: Resolving member definition for word:", word);

    const variableType: string =
      userClass == null ? userVariable.type : userClass.name;

    // Check if the variable's type is a user-defined class
    if (userClass === null) {
      userClass = definitionProvider.findUserDefinedClass(variableType);
    }

    if (!userClass) {
      console.log(
        `Type '${variableType}' of variable '${userVariable.name}' is not a user-defined class, cannot resolve member '${word}'.`
      );
      return null;
    }

    console.log(
      `Looking for member '${word}' in class '${userClass.name}' members.`
    );

    // Check if the member is a field
    const classField = userClass.fields.find((field) => field.name === word);
    if (classField) {
      console.log(
        `Found field '${classField.name}' of class '${userClass.name}', continuing traversal.`
      );
      userVariable = classField;

      if (memberParts.length === 0) {
        // Last part, return definition
        return { field: classField };
      } else {
        // Continue traversal
        const fieldType = classField.type;
        userClass = definitionProvider.findUserDefinedClass(fieldType);
        if (!userClass) {
          console.log(
            `Type '${fieldType}' of field '${classField.name}' is not a user-defined class, stopping traversal.`
          );
          return null;
        }
      }
    }

    // Check if the member is a method
    const classMethod = userClass.methods.find(
      (method) => method.name === word
    );
    if (classMethod) {
      console.log(
        `Found method '${classMethod.name}' of class '${userClass.name}', continuing traversal.`
      );

      if (memberParts.length === 0) {
        // Last part, return definition
        return { method: classMethod };
      }
      // For methods, we cannot continue traversal, so we stop here
      return null;
    }

    console.log(`Member '${word}' not found in class '${userClass.name}'.`);

    if (userClass.parentName) {
      console.log(
        `Class '${userClass.name}' has a parent class '${userClass.parentName}', attempting to resolve member '${word}' in parent class.`
      );
      const parentClass = definitionProvider.findUserDefinedClass(
        userClass.parentName
      );
      if (parentClass) {
        console.log(`Switching to parent class '${parentClass.name}' members.`);
        userClass = parentClass;
        // retry finding the member in the parent class
        memberParts.unshift(word);
      }
    }
  }

  return null;
};
