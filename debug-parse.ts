import { Parser } from "./leekscript-ts/src/compiler/Parser";

console.log("Test 1: With space");
let code =
  "Array <Array<real | integer>> effects = getChipEffects(CHIP_ANTIDOTE)";
testParse(code);

console.log("\n\nTest 2: Without space");
code = "Array<Array<real | integer>> effects = getChipEffects(CHIP_ANTIDOTE)";
testParse(code);

function testParse(code: string) {
  const parser = new Parser(code, 4);

  try {
    const ast = parser.parse();
    console.log("Parsed successfully!");
    console.log("AST type:", ast.constructor.name);
    console.log("AST keys:", Object.keys(ast));

    const statements = (ast as any).statements || (ast as any).body;
    if (!statements) {
      console.log("Full AST:", JSON.stringify(ast, null, 2));
    } else {
      console.log("Number of statements:", statements.length);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        console.log(`\nStatement ${i}:`, stmt.constructor.name);
        if (
          stmt.constructor.name === "ExpressionStatement" &&
          stmt.expression
        ) {
          console.log("  Expression:", stmt.expression.constructor.name);
          if (stmt.expression.constructor.name === "Identifier") {
            console.log("  Name:", stmt.expression.name);
          } else if (stmt.expression.constructor.name === "BinaryExpression") {
            console.log("  Operator:", stmt.expression.operator);
            console.log(
              "  Left:",
              stmt.expression.left?.constructor?.name,
              stmt.expression.left?.name
            );
            console.log(
              "  Right:",
              stmt.expression.right?.constructor?.name,
              stmt.expression.right?.name
            );
          } else if (
            stmt.expression.constructor.name === "AssignmentExpression"
          ) {
            console.log(
              "  Left:",
              stmt.expression.left?.constructor?.name,
              stmt.expression.left?.name
            );
            console.log("  Right:", stmt.expression.right?.constructor?.name);
          }
        }
      }
    }
  } catch (error: any) {
    console.log("Parse error:", error.message);
  }
}
