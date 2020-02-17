# MySQL data source connector

The MySQL data source connector connects Prisma to a MySQL database server.

## Example

To connect to a MySQL database server, you need to configure a [`datasource`](../../prisma-schema-file.md#data-sources) block in your [schema file](../../prisma-schema-file.md):

```prisma
datasource mysql {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ... the file should also contain a data model definition and (optionally) generators
```

The fields passed to the `datasource` block are:

- `provider`: Specifies the `mysql` data source connector.
- `url`: Specifies the [connection string](#connection-string) for the MySQL database server. In this case, we're [using an environment variable](../../prisma-schema-file.md#using-environment-variables) to provide the connection string.

Find more information on the `datasource` fields [here](../../prisma-schema-file.md#data-sources).

## Data model mapping

The MySQL connector maps the [scalar types](../../data-modeling.md#scalar-types) from the [data model](../../data-modeling.md) to native column types as follows:

| Data model  | MySQL  |
| -------- | --------- | 
| `String`   | `TEXT`      | 
| `Boolean`  | `BOOLEAN`   |
| `Int`      | `INT`   |
| `Float`    | `FLOAT`      |
| `Datetime` | `TIMESTAMP` |

## Connection details

### Connection string

MySQL offers two styles of connection strings:

- Key-value string: `{user:'user', host:'localhost', schema:'world'}`
- Connection URI: `mysql://user@localhost:3333`

See the [official documentation](https://dev.mysql.com/doc/refman/8.0/en/connecting-using-uri-or-key-value-pairs.html) for details.

### Configuration options

- `host`: The IP address/domain of your database server, e.g. `localhost`.
- `port`: The port on which your database server listens, e.g. `5432`.
- `database`: The name of the database. 
- `user`: The database user, e.g. `admin`.
- `password`: The password for the database user.
- `ssl`: Whether or not your database server uses SSL.
- `connection_limit`: The connection limit specifies the maximum number of simultaneous connections that Prisma might have open to your database.
- `socket`: If you want to connect via sockets, this parameter must specified a file path to the socket you want to use, e.g.: `/var/run/mysqld/mysqld.sock`. (Learn more in this [GitHub issue](https://github.com/prisma/prisma2/issues/525)).
- `connect_timeout`: The maximum number of seconds to wait for a new connection. **Default**: `5`. 
- `socket_timeout`: The maximum number of seconds to wait until a single query terminates. **Default**: `5`. 