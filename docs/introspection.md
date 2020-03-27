# Introspection

When working with an existing database, the first step towards using Prisma 2 is to obtain a [Prisma schema](./prisma-schema-file.md) that matches your database schema (or a subset of your database schema). You can create this schema file manually and write out all the required [models](./data-modeling.md#models) by hand, or use Prisma's _introspection_ feature to automatically generate your Prisma schema. 

Prisma lets you introspect your database to derive a data model definition from the current database schema. Introspection is available via the following CLI command:

```
prisma2 introspect
```

This command assumes Prisma is already connected to your database and (re)introspects it for you. Typically used in "Prisma Client"-only projects where migrations are performed not via Prisma's `migrate` command, so the data model needs to be updated manually after each database schema change. **Note that this commands overrides your current `schema.prisma` file. Any comments or [attributes](./data-modeling.md#attributes) that are not defined on a databse-level will be removed.**

Note that `prisma2 introspect` requires the connection string for the database you want to introspect. Therefore, you need to run the command inside of a directory that contains a [Prisma schema](./prisma-schema-file.md) with a valid `datasource` definition (which contains the connection string)

## Introspecting only a subset of your database schema

This is [not yet supported by Prisma](https://github.com/prisma/prisma2/issues/807). However, you can achieve this by creating a new database user that only has access to the tables which you'd like to see represented in your Prisma schema, and then perform the introspection using that user. The introspection will then only include the tables the new user has access to.

## Conventions

As database schemas are likely to look very different per project, Prisma employs a number of conventions for translating a database schema into a data model definition:

- Field, model and enum names (identifiers) must start with a letter and generally must only contain underscores, letters and digits.
- If invalid characters appear before a letter in an identifier, they get dropped. If they appear after the initial letter, they are replaced by an underscorce. Additionally, the transformed name is mapped to the database using `@map` or `@@map` to retain the original name.
- If sanitization results in duplicate identifiers, no immediate error handling is in place. You get the error later and can manually fix it.
- Relation names for a relation between models A and B are generated as `AToB` (the model that comes first in alphabetical order also appears first in the generated relation name). If relation names turn out to be ambiguous because there is more than one relation between models `A` and `B`, the field name of the column that holds the foreign key is appended to the model name after an underscore to disambiguate, e.g.: `A_FieldWithFKToB`. 
- The name of the back-relation field is based on the opposing model. It gets camel cases by defauld and pluralized (unless the column with the foreign key also has a unique constraint). If back-relation fields are ambiguous, the relation name is appended to disambiguate.

## Common workarounds

### Tables without unique identifiers

Prisma can only map a table in your database to a Prisma model if the table has a _unique identifier_. This can be either of the follwing:

- The table contains a column with a `UNIQUE` constraint
- The table contains a column with a `PRIMARY KEY` constraint

If there are tables that don't adhere to this requirement, they're added as comments to the Prisma schema. 

Consider the following SQL table:

```sql
CREATE TABLE countries (
  name VARCHAR(255),
  population INT
);
```

This table neither has column with a `UNIQUE` nor with a `PRIMARY KEY` constraint. Therefore, it would appear in a Prisma schema that's generated through introspection as follows:

```prisma
// model countries {
//   name       String
//   population Int
// }
```

To fix this, you can add add a `PRIMARY KEY` or a `UNIQUE` constraint to the table.

#### Adding a `PRIMARY KEY` constraint

A straightforward solution to the problem is to adds a serial/auto-incrementing, primary key column to the table. 

```sql
-- PostgreSQL
ALTER TABLE "public"."countries"
  ADD COLUMN "id" serial,
  ADD PRIMARY KEY ("id");

-- MySQL
ALTER TABLE countries 
  ADD COLUMN id bigint PRIMARY KEY NOT NULL SERIAL DEFAULT VALUE;
```

Note that with SQLite, you can't add primary key columns to existing tables but have to delete and re-create it with the desired constraint.

#### Adding a `UNIQUE` constraint

This example show how to add a `UNIQUE` constraint (asssuming the column actually only contains unique values):

```sql
-- PostgreSQL
ALTER TABLE "public"."countries" ADD UNIQUE ("population");

-- MySQL
ALTER TABLE countries ADD UNIQUE (population);
```

Note that with SQLite, [you can't alter columns](https://stackoverflow.com/questions/4007014/alter-column-in-sqlite) but have to delete and re-create it with the desired constraint.


## Mapping PostgreSQL types to Prisma

| PostgreSQL type | Prisma type | Note                                                       |
| :-------------- | :---------- | :--------------------------------------------------------- |
| `int2`          | `Int`       |                                                            |
| `int4`          | `Int`       |                                                            |
| `int8`          | `Int`       |                                                            |
| `float4`        | `Float`     |                                                            |
| `float8`        | `Float`     |                                                            |
| `bool`          | `Boolean`   |                                                            |
| `text`          | `String`    |                                                            |
| `varchar`       | `String`    |                                                            |
| `date`          | `DateTime`  |                                                            |
| `DateTime`      | `String`    |                                                            |
| `json`          | `String`    | Will be mapped to `Json` once it's supported.              |
| `jsonb`         | `String`    | Will be mapped to `Json` once it's supported.              |
| `uuid`          | `String`    | Will be mapped to `Uuid` once it's supported.              |
| `bit`           | `String`    | Will be mapped to `Binary` once it's supported.            |
| `varbit`        | `String`    | Will be mapped to `Binary` once it's supported.            |
| `box`           | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `circle`        | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `line`          | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `lseg`          | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `path`          | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `polygon`       | `String`    | Will be mapped to `Geometric` once it's supported.         |
| `bpchar`        | `String`    |                                                            |
| `interval`      | `DateTime`  |                                                            |
| `numeric`       | `Float`     |                                                            |
| `pg_lsn`        | `String`    | Will be mapped to `LogSequenceNumber` once it's supported. |
| `time`          | `DateTime`  |                                                            |
| `timetz`        | `DateTime`  |                                                            |
| `timestamp`     | `DateTime`  |                                                            |
| `timestamptz`   | `DateTime`  |                                                            |
| `tsquery`       | `String`    | Will be mapped to `TextSearch` once it's supported.        |
| `tsvector`      | `String`    | Will be mapped to `TextSearch` once it's supported.        |
| `txid_snapshot` | `String`    | Will be mapped to `TransactionId` once it's supported.     |
| `_bytea`        | `String`    | Will be mapped to `Binary` once it's supported.            |
| `_bool`         | `Boolean`   |                                                            |
| `_date`         | `DateTime`  |                                                            |
| `_float8`       | `Float`     |                                                            |
| `_float4`       | `Float`     |                                                            |
| `_int4`         | `Int`       |                                                            |
| `_text`         | `String`    |                                                            |
| `_varchar`      | `String`    |                                                            |

You can find an overview of all PostgreSQL types [here](https://www.mysqltutorial.org/mysql-data-types.aspx).

## Mapping MySQL types to Prisma

| MySQL type           | Prisma type | Note                                               |
| :------------------- | :---------- | :------------------------------------------------- |
| `int`                | `Int`       |                                                    |
| `smallint`           | `Int`       |                                                    |
| `tinyint(1)`         | `Boolean`   |                                                    |
| `tinyint`            | `Int`       |                                                    |
| `mediumint`          | `Int`       |                                                    |
| `bigint`             | `Int`       |                                                    |
| `decimal`            | `Float`     |                                                    |
| `double`             | `Float`     |                                                    |
| `date`               | `DateTime`  |                                                    |
| `time`               | `DateTime`  |                                                    |
| `datetime`           | `DateTime`  |                                                    |
| `timestamp`          | `DateTime`  |                                                    |
| `year`               | `DateTime`  |                                                    |
| `char`               | `String`    |                                                    |
| `varchar`            | `String`    |                                                    |
| `text`               | `String`    |                                                    |
| `tinytext`           | `String`    |                                                    |
| `mediumtext`         | `String`    |                                                    |
| `longtext`           | `String`    |                                                    |
| `enum`               | `String`    |                                                    |
| `set`                | `String`    |                                                    |
| `binary`             | `String`    | Will be mapped to `Binary` once it's supported.    |
| `varbinary`          | `String`    | Will be mapped to `Binary` once it's supported.    |
| `blob`               | `String`    | Will be mapped to `Binary` once it's supported.    |
| `tinyblob`           | `String`    | Will be mapped to `Binary` once it's supported.    |
| `mediumblob`         | `String`    | Will be mapped to `Binary` once it's supported.    |
| `longblob`           | `String`    | Will be mapped to `Binary` once it's supported.    |
| `geometry`           | `String`    | Will be mapped to `Geometric` once it's supported. |
| `point`              | `String`    | Will be mapped to `Geometric` once it's supported. |
| `linestring`         | `String`    | Will be mapped to `Geometric` once it's supported. |
| `polygon`            | `String`    | Will be mapped to `Geometric` once it's supported. |
| `multipoint`         | `String`    | Will be mapped to `Geometric` once it's supported. |
| `multilinestring`    | `String`    | Will be mapped to `Geometric` once it's supported. |
| `multipolygon`       | `String`    | Will be mapped to `Geometric` once it's supported. |
| `geometrycollection` | `String`    | Will be mapped to `Geometric` once it's supported. |
| `json`               | `String`    | Will be mapped to `Json` once it's supported.      |

You can find an overview of all MySQL types [here](https://www.mysqltutorial.org/mysql-data-types.aspx).

## Mapping SQLite types to Prisma

| SQLite type  | Prisma type | Note                                            |
| :----------- | :---------- | :---------------------------------------------- |
| `integer`    | `Int`       |                                                 |
| `real`       | `Float`     |                                                 |
| `float`      | `Float`     |                                                 |
| `serial`     | `Int`       |                                                 |
| `boolean`    | `Boolean`   |                                                 |
| `text`       | `String`    |                                                 |
| `date`       | `DateTime`  |                                                 |
| `datetime`   | `DateTime`  |                                                 |
| `binary`     | `String`    | Will be mapped to `Binary` once it's supported. |
| `double`     | `Float`     |                                                 |
| `binary[]`   | `String`    | Will be mapped to `Binary` once it's supported. |
| `boolean[]`  | `Boolean`   |                                                 |
| `date[]`     | `DateTime`  |                                                 |
| `datetime[]` | `DateTime`  |                                                 |
| `float[]`    | `Float`     |                                                 |
| `double[]`   | `Float`     |                                                 |
| `integer[]`  | `Int`       |                                                 |
| `text[]`     | `String`    |                                                 |
| `timestamp`  | `DateTime`  |                                                 |

You can find an overview of all SQLite types [here](https://www.sqlite.org/datatype3.html#datatypes_in_sqlite).
