export interface GetDefinitionsResponse2 {
  classes: UserClass[];
  functions: UserFunction[];
  globals: UserVariable[];
  variables: UserVariable[];
}

export interface UserClass {
  col: number;
  constructors: UserMethod[];
  fields: any[];
  fileName: string;
  folderName: string;
  isStatic: boolean;
  line: number;
  methods: UserMethod[];
  name: string;
}

export interface UserMethod {
  arguments: UserArgument[];
  col: number;
  fileName: string;
  folderName: string;
  line: number;
  name: string;
  returnType: string;
}

export interface DefinedClassesDict {}

export interface UserFunction {
  arguments: UserArgument[];
  col: number;
  fileName: string;
  folderName: string;
  line: number;
  name: string;
  returnType: string;
}

export interface UserArgument {
  name: string;
  type: string;
  optional?: boolean;
}

export interface UserVariable {
  col: number;
  fileName: string;
  folderName: string;
  line: number;
  name: string;
  type: string;
}
