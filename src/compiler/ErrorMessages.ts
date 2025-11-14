/**
 * Error message templates for LeekScript compiler errors
 * Maps ErrorType enum to human-readable messages
 */

import { ErrorType } from "./ErrorSystem";

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NONE]: "No error",
  [ErrorType.FUNCTION_NAME_UNAVAILABLE]: "Function name unavailable",
  [ErrorType.PARAMETER_NAME_UNAVAILABLE]: "Parameter name unavailable",
  [ErrorType.OPENING_PARENTHESIS_EXPECTED]: "Opening parenthesis expected",
  [ErrorType.OPENING_CURLY_BRACKET_EXPECTED]: "Opening curly bracket expected",
  [ErrorType.PARAMETER_NAME_EXPECTED]: "Parameter name expected",
  [ErrorType.FUNCTION_NAME_EXPECTED]: "Function name expected",
  [ErrorType.PARENTHESIS_EXPECTED_AFTER_PARAMETERS]:
    "Parenthesis expected after parameters",
  [ErrorType.OPEN_BLOC_REMAINING]: "Open block remaining",
  [ErrorType.NO_BLOC_TO_CLOSE]: "No block to close",
  [ErrorType.END_OF_SCRIPT_UNEXPECTED]: "End of script unexpected",
  [ErrorType.END_OF_INSTRUCTION_EXPECTED]: "End of instruction expected",
  [ErrorType.BREAK_OUT_OF_LOOP]: "Break statement outside of loop",
  [ErrorType.CONTINUE_OUT_OF_LOOP]: "Continue statement outside of loop",
  [ErrorType.INCLUDE_ONLY_IN_MAIN_BLOCK]: "Include only allowed in main block",
  [ErrorType.AI_NAME_EXPECTED]: "AI name expected",
  [ErrorType.AI_NOT_EXISTING]: "AI not found: {0}",
  [ErrorType.CLOSING_PARENTHESIS_EXPECTED]: "Closing parenthesis expected",
  [ErrorType.CLOSING_SQUARE_BRACKET_EXPECTED]:
    "Closing square bracket expected",
  [ErrorType.FUNCTION_ONLY_IN_MAIN_BLOCK]:
    "Function declarations only allowed in main block",
  [ErrorType.VARIABLE_NAME_EXPECTED]: "Variable name expected",
  [ErrorType.VARIABLE_NAME_UNAVAILABLE]: "Variable name unavailable",
  [ErrorType.VARIABLE_NOT_EXISTS]: "Variable does not exist",
  [ErrorType.KEYWORD_UNEXPECTED]: "Unexpected keyword",
  [ErrorType.KEYWORD_IN_EXPECTED]: 'Keyword "in" expected',
  [ErrorType.WHILE_EXPECTED_AFTER_DO]: '"while" expected after "do"',
  [ErrorType.NO_IF_BLOCK]: 'No "if" block',
  [ErrorType.GLOBAL_ONLY_IN_MAIN_BLOCK]:
    "Global declarations only allowed in main block",
  [ErrorType.VAR_NAME_EXPECTED_AFTER_GLOBAL]:
    'Variable name expected after "global"',
  [ErrorType.VAR_NAME_EXPECTED]: "Variable name expected",
  [ErrorType.SIMPLE_ARRAY]: "Simple array",
  [ErrorType.ASSOCIATIVE_ARRAY]: "Associative array",
  [ErrorType.PARENTHESIS_EXPECTED_AFTER_FUNCTION]:
    "Parenthesis expected after function",
  [ErrorType.UNKNOWN_VARIABLE_OR_FUNCTION]: "Unknown variable or function: {0}",
  [ErrorType.OPERATOR_UNEXPECTED]: "Unexpected operator",
  [ErrorType.VALUE_EXPECTED]: "Value expected",
  [ErrorType.CANT_ADD_INSTRUCTION_AFTER_BREAK]:
    "Cannot add instruction after break",
  [ErrorType.UNCOMPLETE_EXPRESSION]: "Incomplete expression",
  [ErrorType.CANT_ASSIGN_VALUE]: "Cannot assign value",
  [ErrorType.FUNCTION_NOT_EXISTS]: "Function does not exist",
  [ErrorType.INVALID_PARAMETER_COUNT]: "Invalid parameter count",
  [ErrorType.INVALID_CHAR]: "Invalid character",
  [ErrorType.INVALID_NUMBER]: "Invalid number",
  [ErrorType.CONSTRUCTOR_ALREADY_EXISTS]: "Constructor already exists",
  [ErrorType.END_OF_CLASS_EXPECTED]: "End of class expected",
  [ErrorType.FIELD_ALREADY_EXISTS]: "Field already exists",
  [ErrorType.NO_SUCH_CLASS]: "No such class",
  [ErrorType.THIS_NOT_ALLOWED_HERE]: '"this" not allowed here',
  [ErrorType.KEYWORD_MUST_BE_IN_CLASS]: "Keyword must be in class",
  [ErrorType.SUPER_NOT_AVAILABLE_PARENT]: '"super" not available (no parent)',
  [ErrorType.CLASS_MEMBER_DOES_NOT_EXIST]: "Class member does not exist",
  [ErrorType.CLASS_STATIC_MEMBER_DOES_NOT_EXIST]:
    "Class static member does not exist",
  [ErrorType.EXTENDS_LOOP]: "Circular class inheritance",
  [ErrorType.REFERENCE_DEPRECATED]: "Reference deprecated",
  [ErrorType.DUPLICATED_METHOD]: "Duplicated method",
  [ErrorType.DEPRECATED_FUNCTION]: "Deprecated function",
  [ErrorType.UNKNOWN_FUNCTION]: "Unknown function",
  [ErrorType.DIVISION_BY_ZERO]: "Division by zero",
  [ErrorType.CAN_NOT_EXECUTE_VALUE]: "Cannot execute value",
  [ErrorType.CAN_NOT_EXECUTE_WITH_ARGUMENTS]: "Cannot execute with arguments",
  [ErrorType.NO_AI_EQUIPPED]: "No AI equipped",
  [ErrorType.INVALID_AI]: "Invalid AI",
  [ErrorType.COMPILE_JAVA]: "Compilation error",
  [ErrorType.AI_DISABLED]: "AI disabled",
  [ErrorType.AI_INTERRUPTED]: "AI interrupted",
  [ErrorType.AI_TIMEOUT]: "AI timeout (30 seconds exceeded)",
  [ErrorType.CODE_TOO_LARGE]: "Code too large",
  [ErrorType.CODE_TOO_LARGE_FUNCTION]: "Function code too large",
  [ErrorType.INTERNAL_ERROR]: "Internal error",
  [ErrorType.UNKNOWN_METHOD]: "Unknown method",
  [ErrorType.UNKNOWN_STATIC_METHOD]: "Unknown static method",
  [ErrorType.STRING_METHOD_MUST_RETURN_STRING]:
    "String method must return string",
  [ErrorType.UNKNOWN_FIELD]: "Unknown field",
  [ErrorType.UNKNOWN_CONSTRUCTOR]: "Unknown constructor",
  [ErrorType.INSTANCEOF_MUST_BE_CLASS]:
    '"instanceof" must be used with a class',
  [ErrorType.NOT_ITERABLE]: "Not iterable",
  [ErrorType.STACKOVERFLOW]: "Stack overflow",
  [ErrorType.INVALID_OPERATOR]: "Invalid operator",
  [ErrorType.PRIVATE_FIELD]: "Private field",
  [ErrorType.PROTECTED_FIELD]: "Protected field",
  [ErrorType.PRIVATE_STATIC_FIELD]: "Private static field",
  [ErrorType.PROTECTED_STATIC_FIELD]: "Protected static field",
  [ErrorType.PRIVATE_METHOD]: "Private method",
  [ErrorType.PROTECTED_METHOD]: "Protected method",
  [ErrorType.PRIVATE_CONSTRUCTOR]: "Private constructor",
  [ErrorType.PROTECTED_CONSTRUCTOR]: "Protected constructor",
  [ErrorType.PRIVATE_STATIC_METHOD]: "Private static method",
  [ErrorType.PROTECTED_STATIC_METHOD]: "Protected static method",
  [ErrorType.CANNOT_LOAD_AI]: "Cannot load AI",
  [ErrorType.TRANSPILE_TO_JAVA]: "Transpile to Java error",
  [ErrorType.CANNOT_WRITE_AI]: "Cannot write AI",
  [ErrorType.RESERVED_FIELD]: "Reserved field",
  [ErrorType.VALUE_IS_NOT_AN_ARRAY]: "Value is not an array",
  [ErrorType.TRIPLE_EQUALS_DEPRECATED]: "Triple equals deprecated (use ==)",
  [ErrorType.REMOVED_FUNCTION]: "Function removed",
  [ErrorType.FUNCTION_NOT_AVAILABLE]: "Function not available",
  [ErrorType.ARRAY_OUT_OF_BOUND]: "Array index out of bounds",
  [ErrorType.MAP_DUPLICATED_KEY]: "Duplicated key in map",
  [ErrorType.WRONG_ARGUMENT_TYPE]: "Wrong argument type",
  [ErrorType.UNKNOWN_ERROR]: "Unknown error",
  [ErrorType.INVALID_VALUE]: "Invalid value",
  [ErrorType.TOO_MUCH_OPERATIONS]: "Too many operations",
  [ErrorType.ARRAY_TOO_LARGE]: "Array too large",
  [ErrorType.OUT_OF_MEMORY]: "Out of memory",
  [ErrorType.MULTIPLE_NUMERIC_SEPARATORS]: "Multiple numeric separators",
  [ErrorType.REMOVED_FUNCTION_REPLACEMENT]: "Function removed, use {0} instead",
  [ErrorType.CANNOT_REDEFINE_FUNCTION]: "Cannot redefine function",
  [ErrorType.CANNOT_ASSIGN_FINAL_FIELD]: "Cannot assign final field",
  [ErrorType.CANNOT_ASSIGN_FINAL_VALUE]: "Cannot assign final value",
  [ErrorType.DUPLICATED_CONSTRUCTOR]: "Duplicated constructor",
  [ErrorType.ARROW_EXPECTED]: "Arrow (=>) expected",
  [ErrorType.MODIFICATION_DURING_ITERATION]: "Modification during iteration",
  [ErrorType.ENTITY_DIED]: "Entity died",
  [ErrorType.HELP_PAGE_LINK]: "See help page",
  [ErrorType.ASSIGN_SAME_VARIABLE]: "Assigning variable to itself",
  [ErrorType.COMPARISON_ALWAYS_FALSE]: "Comparison always false",
  [ErrorType.COMPARISON_ALWAYS_TRUE]: "Comparison always true",
  [ErrorType.UNKNOWN_OPERATOR]: "Unknown operator: {0}",
  [ErrorType.DUPLICATED_ARGUMENT]: "Duplicated argument",
  [ErrorType.ASSIGNMENT_INCOMPATIBLE_TYPE]:
    "Incompatible type in assignment: cannot assign {1} to {0}",
  [ErrorType.CLOSING_CHEVRON_EXPECTED]: "Closing chevron (>) expected",
  [ErrorType.TYPE_EXPECTED]: "Type expected",
  [ErrorType.IMPOSSIBLE_CAST]: "Impossible cast",
  [ErrorType.COMMA_EXPECTED]: "Comma expected",
  [ErrorType.INCOMPATIBLE_TYPE]: "Incompatible type: expected {0}, got {1}",
  [ErrorType.DANGEROUS_CONVERSION]: "Dangerous conversion from {0} to {1}",
  [ErrorType.DANGEROUS_CONVERSION_VARIABLE]:
    "Dangerous conversion in variable from {0} to {1}",
  [ErrorType.MAY_NOT_BE_ITERABLE]: "Value may not be iterable",
  [ErrorType.NOT_CALLABLE]: "Not callable",
  [ErrorType.MAY_NOT_BE_CALLABLE]: "Value may not be callable",
  [ErrorType.IMPOSSIBLE_CAST_VALUES]: "Impossible cast between values",
  [ErrorType.FIELD_MAY_NOT_EXIST]: "Field may not exist",
  [ErrorType.USELESS_NON_NULL_ASSERTION]: "Useless non-null assertion",
  [ErrorType.MAY_NOT_BE_INDEXABLE]: "Value may not be indexable",
  [ErrorType.NOT_INDEXABLE]: "Not indexable",
  [ErrorType.OVERRIDDEN_METHOD_DIFFERENT_TYPE]:
    "Overridden method has different type",
  [ErrorType.USELESS_CAST]: "Useless cast",
  [ErrorType.TOO_MUCH_ERRORS]: "Too many errors",
  [ErrorType.INTERVAL]: "Interval",
  [ErrorType.OPERATOR_IN_ON_INVALID_CONTAINER]:
    'Operator "in" on invalid container',
  [ErrorType.CANNOT_ITERATE_UNBOUNDED_INTERVAL]:
    "Cannot iterate unbounded interval",
  [ErrorType.UNARY_OPERATOR_INCOMPATIBLE_TYPE]:
    "Unary operator incompatible with type",
  [ErrorType.INTERVAL_INFINITE_CLOSED]: "Infinite closed interval",
  [ErrorType.DOT_DOT_EXPECTED]: '".." expected',
  [ErrorType.STRING_NOT_CLOSED]: "String not closed",
  [ErrorType.DEFAULT_ARGUMENT_NOT_END]: "Default arguments must be at end",
};

/**
 * Get formatted error message with parameters
 */
export function formatErrorMessage(
  errorType: ErrorType,
  parameters: string[] = []
): string {
  let message = ERROR_MESSAGES[errorType] || `Error ${errorType}`;

  // Replace {0}, {1}, etc. with parameters
  for (let i = 0; i < parameters.length; i++) {
    message = message.replace(`{${i}}`, parameters[i]);
  }

  return message;
}
