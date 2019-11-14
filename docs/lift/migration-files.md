# Migration files

When saving a migration with `prisma lift save`, Lift creates three migration files for you:

- `README.md`
- `datamodel.prisma`
- `steps.json`

## `README.md`

The README contains information about the migration in human-readable form:

- An overview of the SQL statements that will be executed by Lift when you run `prisma2 lift up`
- A diff of the changes in your [Prisma schema](../prisma-schema-file.md)

## `schema.prisma`

The `schema.prisma` file represents the target [Prisma schema](../prisma-schema-file.md) of the migration.

## `steps.json`

The `steps.json` is another representation of the steps that will be performed by Lift when you're executing the migration with `prisma2 lift up`. You can learn more about it in the [spec](https://github.com/prisma/specs/tree/lift/document-migration-steps/lift#step).