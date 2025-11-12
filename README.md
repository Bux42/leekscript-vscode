# LeekScript Language Support

A Visual Studio Code extension that provides language support for LeekScript.

## Features

- **Syntax Highlighting**: Full syntax highlighting for LeekScript files (`.leek`, `.ls`)
- **Auto-completion**: IntelliSense support with keyword and built-in function suggestions
- **Bracket Matching**: Automatic bracket, parenthesis, and quote pairing
- **Code Folding**: Support for region folding with `//region` and `//endregion` markers
- **Comments**: Line comments (`//`) and block comments (`/* */`)

## Language Features

### Supported Keywords

- Control flow: `if`, `else`, `while`, `for`, `do`, `break`, `continue`, `return`, `switch`, `case`, `default`
- Exception handling: `try`, `catch`, `throw`, `finally`
- Declarations: `var`, `let`, `const`, `function`, `class`
- Operators: `and`, `or`, `not`, `in`, `instanceof`, `typeof`
- Constants: `true`, `false`, `null`, `undefined`, `this`, `new`

### Data Types

- `int`, `float`, `string`, `bool`, `array`, `object`, `void`

### Built-in Functions (Example)

- `print`, `debug`, `sqrt`, `pow`, `abs`, `floor`, `ceil`, `round`

## Installation

### From Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Press `F5` to open a new VSCode window with the extension loaded

### From VSIX

1. Package the extension: `vsce package`
2. Install the `.vsix` file in VSCode

## Usage

1. Create a new file with `.leek` or `.ls` extension
2. Start coding in LeekScript!
3. Enjoy syntax highlighting and auto-completion

## Example

```leekscript
// Example LeekScript code
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

var result = fibonacci(10);
print("Fibonacci(10) = " + result);

// Array manipulation
var numbers = [1, 2, 3, 4, 5];
for (var i = 0; i < numbers.length; i++) {
    print("Number: " + numbers[i]);
}
```

## Development

### Building

```bash
npm install
npm run compile
```

### Testing

Press `F5` in VSCode to launch an Extension Development Host window.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

MIT

## Release Notes

### 0.0.1

Initial release of LeekScript language support:

- Basic syntax highlighting
- Auto-completion for keywords and built-ins
- Language configuration (brackets, comments, auto-closing pairs)
