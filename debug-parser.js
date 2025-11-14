/**
 * Debug script to see how leekscript-ts parses the code
 */

const { Parser } = require("./leekscript-ts/dist/index");

const code = `integer enemy = getNearestEnemy();

if (count(getWeapons())) {
	setWeapon(getWeapons()[0]);
}

moveToward(enemy);

useWeapon(enemy);

integer name = getName()
string nearestEnemyId = getNearestEnemy();`;

const parser = new Parser(code, 2); // Version 2
const program = parser.parse();

console.log("Program:", JSON.stringify(program, null, 2));
console.log("\nFirst statement:", program.statements[0]);
console.log("First statement type:", program.statements[0].constructor.name);
console.log("First statement expression:", program.statements[0].expression);
