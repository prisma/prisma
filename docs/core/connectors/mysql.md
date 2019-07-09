# MySQL data source connector

The MySQL data source connector connects Prisma to a MySQL database server.

## Example

To connect to a MySQL database server, you need to configure a [`datasource`](../../prisma-schema-file.md#data-sources) block in your [schema file](../../prisma-schema-file.md):

```groovy
datasource pg {
  provider = "mysql"
  url      = env("MYSQL_URL")
}

// ... the file should also contain a data model definition and (optionally) generators
```

The fields passed to the `datasource` block are:

- `provider`: Specifies the `mysql` data source connector.
- `url`: Specifies the [connection string](#connection-string) for the MySQL database server. In this case, we're [using an environment variable](../../prisma-schema-file.md#using-environment-variables) to provide the connection string.

Find more information on the `datasource` fields [here](../../prisma-schema-file.md#data-sources).

## Data model mapping

The MySQL connector maps the [scalar types](../../data-modeling.md#scalar-types) from the [data model](../../data-modeling.md) as follows to native column types:

| Data model  | MySQL  |
| -------- | --------- | 
| `String`   | `TEXT`      | 
| `Boolean`  | `BOOLEAN`   |
| `Int`      | `INT`   |
| `Float`    | `FLOAT`      |
| `Datetime` | `TIMESTAMP` |

## Connection details

### Connection string

MySQL offers also two styles of connection strings. See the [official documentation](https://dev.mysql.com/doc/refman/8.0/en/connecting-using-uri-or-key-value-pairs.html) for details.

- Key-value string: `{user:'user', host:'localhost', schema:'world'}`
- Connection URI: `mysql://user@localhost:3333`

The Rust implementation for MySQL accepts connection strings, but it does not seem to follow the official [MySQL standard](https://dev.mysql.com/doc/refman/8.0/en/connecting-using-uri-or-key-value-pairs.html#connection-parameters). Basic connection strings should just work though. 

### Configuration options

- **Host**: The IP address/domain of your database server, e.g. `localhost`.
- **Post**: The port on which your database server listens, e.g. `5432`.
- **Database**: The name of the database. 
- **User**: The database user, e.g. `admin`.
- **Password**: The password for the database user.
- **SSL**: Whether or not your database server uses SSL.
- **Connection limit** (coming soon): The connection limit specifies the maximum number of simultaneous connections that Prisma might have open to your database. Default: `1`.