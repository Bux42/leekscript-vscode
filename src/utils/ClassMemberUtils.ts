import * as vscode from "vscode";
import { DefinitionManager } from "../providers/user-code/DefinitionManager";
import {
  UserClass,
  UserClassField,
  UserFunction,
  UserVariable,
} from "../services/analyzer/definitions.types";

export interface ResolvedMember {
  method?: UserFunction;
  field?: UserVariable;
}

/**
 * Given a member access chain, resolve the class of the last member, along with its parent classes in the hierarchy
 * @param memberParts Array of member names in the access chain (e.g., ["myVar", "field1", "field2"])
 * @param definitionProvider The definition provider to lookup classes, variables, etc.
 * @returns Array containing the final resolved class and all its parent classes (if any)
 */
export const resolveMemberClass = (
  memberParts: string[],
  definitionProvider: DefinitionManager
): UserClass[] => {
  if (memberParts.length === 0) {
    return [];
  }

  console.log("Resolving member access chain:", memberParts);

  let currentClass: UserClass | null = null;
  let word = memberParts.shift() || "";

  // Step 1: Resolve the first member part (either a variable or a class name)
  const userVariable = definitionProvider.findUserDefinedVariable(word);

  if (userVariable) {
    // It's a variable - get its type
    console.log(`Found variable '${word}' with type '${userVariable.type}'`);
    currentClass = definitionProvider.findUserDefinedClass(userVariable.type);

    if (!currentClass) {
      console.log(`Type '${userVariable.type}' is not a user-defined class`);
      return [];
    }
  } else {
    // Check if it's a class name (for static member access)
    currentClass = definitionProvider.findUserDefinedClass(word);

    if (!currentClass) {
      console.log(`Cannot resolve '${word}' as variable or class`);
      return [];
    }
    console.log(`Found class '${word}'`);
  }

  // Step 2: Traverse through the remaining member parts
  while (memberParts.length > 0) {
    word = memberParts.shift() || "";
    console.log(`Traversing member '${word}' in class '${currentClass.name}'`);

    // Try to find the member in the current class or its parent classes
    let foundMember: UserClassField | undefined;
    let searchClass: UserClass | null = currentClass;

    // Search in current class and parent hierarchy
    while (searchClass && !foundMember) {
      foundMember = searchClass.fields.find((field) => field.name === word);

      if (foundMember) {
        console.log(
          `Found field '${word}' with type '${foundMember.type}' in class '${searchClass.name}'`
        );
        break;
      }

      // Check parent class
      if (searchClass.parentName) {
        searchClass = definitionProvider.findUserDefinedClass(
          searchClass.parentName
        );
        if (searchClass) {
          console.log(`Checking parent class '${searchClass.name}'`);
        }
      } else {
        searchClass = null;
      }
    }

    if (!foundMember) {
      // If this is the last member part (incomplete typing), return the current class
      if (memberParts.length === 0) {
        console.log(
          `Member '${word}' not found but it's the last part - returning current class '${currentClass.name}' for completion`
        );
        // Return the current class and its parents for completion suggestions
        const resultClasses: UserClass[] = [currentClass];
        let parentClass = currentClass;
        while (parentClass.parentName) {
          const parent = definitionProvider.findUserDefinedClass(
            parentClass.parentName
          );
          if (parent) {
            resultClasses.push(parent);
            parentClass = parent;
          } else {
            break;
          }
        }
        return resultClasses;
      }
      console.log(`Member '${word}' not found in class hierarchy`);
      return [];
    }

    // Resolve the field's type to a class for the next iteration
    currentClass = definitionProvider.findUserDefinedClass(foundMember.type);

    if (!currentClass) {
      console.log(
        `Type '${foundMember.type}' of field '${foundMember.name}' is not a user-defined class`
      );
      return [];
    }
  }

  // Step 3: Collect the final class and all its parent classes
  const resultClasses: UserClass[] = [];

  if (!currentClass) {
    return [];
  }

  resultClasses.push(currentClass);
  console.log(`Final resolved class: '${currentClass.name}'`);

  // Collect all parent classes
  let parentClass = currentClass;
  while (parentClass.parentName) {
    const parent = definitionProvider.findUserDefinedClass(
      parentClass.parentName
    );
    if (parent) {
      console.log(`Adding parent class '${parent.name}' to result`);
      resultClasses.push(parent);
      parentClass = parent;
    } else {
      break;
    }
  }

  console.log(`Resolved ${resultClasses.length} class(es) in hierarchy`);
  return resultClasses;
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
