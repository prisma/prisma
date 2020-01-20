# Migration files

When saving a migration with `prisma2 migrate save --experimental`, Prisma creates three migration files for you:

- `README.md`
- `datamodel.prisma`
- `steps.json`

## `README.md`

The README contains information about the migration in human-readable form:

- An overview of the SQL statements that will be executed by Prisma when you run `prisma2 migrate up --experimental`
- A diff of the changes in your [Prisma schema](../prisma-schema-file.md)

## `schema.prisma`

The `schema.prisma` file represents the target [Prisma schema](../prisma-schema-file.md) of the migration.

## `steps.json`

The `steps.json` is another representation of the steps that will be performed by Prisma when you're executing the migration with `prisma2 migrate up --experimental`. You can learn more about it in the [spec](https://github.com/prisma/specs/tree/master/lift#step).
