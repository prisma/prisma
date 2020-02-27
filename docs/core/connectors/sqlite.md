# SQLite

The SQLite data source connector connects Prisma to a [SQLite](https://www.sqlite.org/) database file. These files always have the file ending `.db` (e.g.: `dev.db`).

## Example

To connect to a SQLite database file, you need to configure a [`datasource`](../../prisma-schema-file.md#data-sources) block in your [schema file](../../prisma-schema-file.md):

```prisma
datasource sqlite {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ... the file should also contain a data model definition and (optionally) generators
```

The fields passed to the `datasource` block are:

- `provider`: Specifies the `sqlite` data source connector.
- `url`: Specifies the [connection string](#connection-string) for the SQLite database. The connection string always starts with the prefix `file:` and then contains a file path pointing to the SQLite database file. In this case, the file is located in the same directory and called `dev.db`.

Find more information on the `datasource` fields [here](../../prisma-schema-file.md#data-sources).

## Data model mapping

The SQLite connector maps the [scalar types](../../data-modeling.md#scalar-types) from the [data model](../../data-modeling.md) to native column types as follows:

| Data model  | SQLite  |
| -------- | --------- | 
| `String`   | `TEXT`      | 
| `Boolean`  | `BOOLEAN`   |
| `Int`      | `INTEGER`   |
| `Float`    | `REAL`      |

## Connection details

### Connection string

The connection URL of a SQLite connector points to a file on your file system. For example, the following two paths are equivalent because the `.db` iss in the same directory:

```prisma
datasource sqlite {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

is the same as:

```prisma
datasource sqlite {
  provider = "sqlite"
  url      = "file:dev.db"
}
```

You can also target files from the root or any other place in your file system:

```prisma
datasource sqlite {
  provider = "sqlite"
  url      = "file:/Users/janedoe/dev.db"
}
```
