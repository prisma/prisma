# Prisma 2 CLI

## Installation

The Prisma 2 CLI currently requires [Node 8](https://nodejs.org/en/download/releases/) (or higher).

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

Sets up Prisma (i.e. Photon and/or Lift) via an interactive wizard.

### `prisma2 dev`

Starts Prisma [development mode](./development-mode.md).

### `prisma2 generate`

Invokes the generators specified in the Prisma schema file.

### `prisma2 introspect`

Introspects the database and generates a data model from it.

## Lift

### `prisma2 lift save`

Creates a new migration folder based on current data model changes. 

### `prisma2 lift up`

Apply any migrations that have not been applied yet.

### `prisma2 lift down`

Undo migrations.

## Upgrade from Prisma 1 to Prisma 2

### `prisma2 convert`

Convert the Prisma 1 service configuration to a Prisma 2 schema file.
