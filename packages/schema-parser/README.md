# @ork/schema-parser

TypeScript-native Prisma Schema Language parser for Ork ORM.

## Overview

This package provides a complete TypeScript-native implementation for parsing Prisma Schema Language (PSL) files, replacing the Rust-based schema engine with a lightweight, extensible TypeScript solution.

## Features

- **Pure TypeScript**: No binary dependencies, runs anywhere Node.js runs
- **AST Generation**: Converts PSL into structured Abstract Syntax Trees
- **Code Generation**: Generates TypeScript interfaces and types from schemas
- **Error Handling**: Comprehensive error reporting with source locations
- **ESM-only**: Modern ES module architecture

## Installation

```bash
pnpm add @ork/schema-parser
```

## Usage

```typescript
import { parseSchema } from '@ork/schema-parser'

const schema = `
datasource db {
  provider = "postgresql"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
`

const result = parseSchema(schema)

if (result.errors.length === 0) {
  console.log('Schema parsed successfully:', result.ast)
} else {
  console.error('Parse errors:', result.errors)
}
```

## API Reference

### `parseSchema(schema: string, options?: ParseOptions): ParseResult`

Main parsing function that converts PSL source code into an AST.

#### Parameters

- `schema`: The Prisma schema source code as a string
- `options`: Optional parsing configuration

#### Returns

- `ParseResult` containing the AST and any parsing errors

### Classes

- `Lexer`: Tokenizes PSL source code
- `Parser`: Converts tokens into AST nodes
- `CodeGenerator`: Generates TypeScript code from AST

## Development

This package is part of the Ork ORM project and follows its development conventions:

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Development mode with watching
pnpm dev
```

## Architecture

The parser consists of three main phases:

1. **Lexical Analysis** (`Lexer`): Converts source text into tokens
2. **Parsing** (`Parser`): Builds AST from tokens
3. **Code Generation** (`CodeGenerator`): Generates TypeScript from AST

## License

Apache-2.0
