# Introspection

When working with an existing database, the first step towards using the Prisma Framework is to obtain a [Prisma schema](./prisma-schema-file.md) that matches your database schema (or a subset of your database schema). You can create this schema file manually and write out all the required [models](./data-modeling.md#models) by hand, or use Prisma's _introspection_ feature to automatically generate your Prisma schema. 

Prisma lets you introspect your database to derive a data model definition from the current database schema. Introspection is available via either of two CLI commands:

- `prisma2 init`: Interactive wizard that helps you connect to a database and introspect it. Typically used when starting to use Prisma with an existing database.
- `prisma2 introspect`: Assumes Prisma is already connected to your database and (re)introspects it for you. Typically used in [Photon-only](./photon/use-only-photon.md) projects where migrations are performed not via Lift, so the data model needs to be updated manually after each database schema change.

Note that `prisma2 introspect` requires the connection string for the database you want to introspect. Therefore, you either need to run the command inside of a directory that contains a [Prisma schema](./prisma-schema-file.md) with a valid `datasource` definition (which contains the connection string) or pass the `--url` argument, e.g.:

```
prisma2 introspect --url postgresql://janedoe:mypassword42@localhost:5432/mydb
```

## Introspecting only a subset of your database schema

This is [not yet supported by Prisma](https://github.com/prisma/prisma2/issues/807). However, you can achieve this by creating a new database user that only has access to the tables which you'd like to see represented in your Prisma schema, and then perform the introspection using that user. The introspection will then only include the tables the new user has access to.

## Conventions

As database schemas are likely to look very different per project, Prisma employs a number of conventions for translating a database schema into a data model definition.

### Sanitization

- Field, model and enum names (identifiers) have to start with a letter and can only contain `_`, letters and digits.
- If invalid characters appear before a letter in an identifier, they get dropped. If they appear after an initial letter, they are replaced by an underscorce. Plus you get `@map` or `@@map` to retain the original one.
- If sanitization results in duplicate identifiers, no immediate error handling is in place. You get the error later and can manually fix it.
- Relation names: Models A and B -> `AToB`. For two relations between models A and B -> `A_FieldWithFKToB` to disambiguate. 
- Back-relation field:
  - on the other side of the relation: Name of the opposing model + gets camelCases, if list field (FK field has unique constraint), gets pluralized.
  - if back-relation fields are ambiguous, the relation name is appended to both.

