# Prisma Framework CLI

Prisma Framework CLI, see [https://github.com/prisma/prisma2](https://github.com/prisma/prisma2)

## Installation

The Prisma Framework CLI currently requires [Node.js 10](https://nodejs.org/en/download/releases/) (or higher).

### npm

```
npm install -g prisma2
```

### Yarn

```
yarn global add prisma2
```

## General

### `prisma2 init`

Sets up a `prisma/schema.prisma` file in the current directory.

### `prisma2 generate`

Invokes the generators specified in the Prisma project file.

### `prisma2 generate --watch`

Watches the Prisma project file and runs `generate` when the file changes.

### `prisma2 introspect`

Introspects the database and generates a data model from it.

## Migrate

### `prisma2 migrate save --experimental`

Creates a new migration folder based on current data model changes.

### `prisma2 migrate up --experimental`

Apply any migrations that have not been applied yet.

### `prisma2 migrate down --experimental`

Undo migrations.
