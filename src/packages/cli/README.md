# Prisma 2 CLI

Learn more about Prisma 2 in the [docs](https://github.com/prisma/prisma).

## Getting started

Check out the [**"Getting Started"-guide**](https://github.com/prisma/prisma/blob/master/docs/getting-started.md) to get started with Prisma 2.

## Installation

The Prisma 2 CLI currently requires [Node.js 10](https://nodejs.org/en/download/releases/) (or higher).

### npm

```
npm install @prisma/cli --save-dev
```

### Yarn

```
yarn add @prisma/cli --dev
```

## General

### `prisma init`

Sets up a `prisma/schema.prisma` file in the current directory.

### `prisma generate`

Invokes the generators specified in the Prisma project file.

### `prisma generate --watch`

Watches the Prisma project file and runs `generate` when the file changes.

### `prisma introspect`

Introspects the database and generates a data model from it.

## Migrate

### `prisma migrate save --experimental`

Creates a new migration folder based on current data model changes.

### `prisma migrate up --experimental`

Apply any migrations that have not been applied yet.

### `prisma migrate down --experimental`

Undo migrations.
