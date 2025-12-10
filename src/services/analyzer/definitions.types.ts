export interface GetDefinitionsResponse {
  classes: UserClass[];
  functions: UserFunction[];
  globals: UserVariable[];
  variables: UserVariable[];
}

export interface UserDefinitionLocation {
  line: number;
  col: number;
  fileName: string;
  folderName: string;
}

export interface UserClassField extends UserDefinitionLocation {
  name: string;
  type: string;
  level: string;
  isStatic: boolean;
}

export interface UserClass extends UserDefinitionLocation {
  constructors: UserMethod[];
  fields: UserClassField[];
  isStatic: boolean;
  line: number;
  methods: UserMethod[];
  name: string;
  parentName?: string;
}

export interface UserMethod extends UserDefinitionLocation {
  arguments: UserArgument[];
  isStatic: boolean;
  name: string;
  returnType: string;
}

export interface DefinedClassesDict {}

export interface UserFunction extends UserDefinitionLocation {
  arguments: UserArgument[];
  name: string;
  returnType: string;
}

export interface UserArgument {
  name: string;
  type: string;
  optional?: boolean;
}

export interface UserVariable extends UserDefinitionLocation {
  name: string;
  type: string;
}
