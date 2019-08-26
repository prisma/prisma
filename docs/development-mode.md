# Development mode

Prisma 2 supports a _development mode_ which can be launched using the `prisma2 dev` command. When in development mode, Prisma 2 runs a development server in the background that watches your [Prisma schema file](./prisma-schema-file.md). 

Whenever you save any changes in the schema file, the development server:

- (re)generates your data source clients (e.g. Photon)
- updates your database schema ([read below](#migrations-in-development-mode))
- creates a [Prisma Studio](https://github.com/prisma/studio) endpoint for you

Depending on whether you're using [only Photon](./photon/use-only-photon.md) or [only Lift](./lift/use-only-lift.md), it might only perform one of the above tasks. 

## Starting development mode

You can start the development mode by with the following command of the [Prisma 2 CLI](./prisma2-cli.md):

```
prisma2 dev
```

## Stopping development mode

You can stop the development mode by hitting <kbd>CTRL</kbd>+<kbd>C</kbd> two times.

## Migrations in development mode

Typically, when you're using Lift for database migrations, a migration is performed as a 3-step process:

1. **Adjust data model**: Change your [data model definition](./data-modeling.md#data-model-definition) to match your desired database schema.
1. **Save migration**: Run `prisma lift save` to create your [migration files](./migration-files.md) on the file system.
1. **Run migration**: Run `prisma lift up` to perform the migration against your database.

This is **not** how migrations are performed in development mode! When running in development mode, there is only one step:

1. **Adjust data model**: Change your [data model definition](./data-modeling.md#data-model-definition) to match your desired database schema. Then **save** the schema file.

Because the development server is watching your schema file (which includes the data model definition) in the background, it notices that you've performed a change and updates your database schema for you. There are **no migration files** created for this schema update! However, it does update Lift's `_Migrations` table in your database schema.

The development mode lets you make quick changes to your data model as you develop your application without the need to persist these changes in a migration. Only once you're happy with your data model, you can [stop the development mode](#stopping-development-mode) and persist your migration using:

```
prisma2 lift save
prisma2 lift up
```

## Interactions in development mode

The development mode is _interactive_. Not only watches it your [schema file](./prisma-schema-file.md), it also accepts user input as it's running. User input is typically provided by pressing a single character on your keyboard:

- `d`: Shows the current [data model](./data-modeling.md#data-model-definition) diff
- `b`: Navigate back to previous screen
