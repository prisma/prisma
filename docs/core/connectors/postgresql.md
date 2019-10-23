# PostgreSQL data source connector

The PostgreSQL data source connector connects Prisma to a PostgreSQL database server.

## Example

To connect to a PostgreSQL database server, you need to configure a [`datasource`](../../prisma-schema-file.md#data-sources) block in your [schema file](../../prisma-schema-file.md):

```groovy
datasource pg {
  provider = "postgresql"
  url      = env("POSTGRESQL_URL")
}

// ... the file should also contain a data model definition and (optionally) generators
```

The fields passed to the `datasource` block are:

- `provider`: Specifies the `postgresql` data source connector.
- `url`: Specifies the [connection string](#connection-string) for the PostgreSQL database server. In this case, we're [using an environment variable](../../prisma-schema-file.md#using-environment-variables) to provide the connection string.

Find more information on the `datasource` fields [here](../../prisma-schema-file.md#data-sources).

## Data model mapping

The PostgreSQL connector maps the [scalar types](../../data-modeling.md#scalar-types) from the [data model](../../data-modeling.md#scalar-types) as follows to native column types:

| Data model  | PostgreSQL  |
| -------- | --------- | 
| `String`   | `text`      | 
| `Boolean`  | `boolean`   |
| `Int`      | `integer`   |
| `Float`    | `real`      |
| `Datetime` | `timestamp` |

## Connection details

### Connection string

PostgreSQL offers two styles of connection strings:

- Key-value string: `host=localhost port=5432 database=mydb connect_timeout=10`
- Connection URI:
  ```
  postgresql://
  postgresql://localhost
  postgresql://localhost:5433
  postgresql://localhost/mydb
  postgresql://user@localhost
  postgresql://user:secret@localhost
  postgresql://other@localhost/otherdb?connect_timeout=10&application_name=myapp
  postgresql://host1:123,host2:456/somedb?target_session_attrs=any&application_name=myapp
  ```

See the [official documentation](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING) for details.

The connection URI needs to follow the [official format](https://www.postgresql.org/docs/10/libpq-connect.html#id-1.7.3.8.3.6) for PostgreSQL connection strings:

```
postgresql://[user[:password]@][netloc][:port][,...][/database][?param1=value1&...]
```

### Configuration options

- `host`: The IP address/domain of your database server, e.g. `localhost`.
- `port`: The port on which your database server listens, e.g. `5432`.
- `database`: The name of the database with the target schema. 
- `schema`: The name of the target schema. **Default**: `public`.
- `user`: The database user, e.g. `admin`.
- `password`: The password for the database user.
- `connection_limit`: The connection limit specifies the maximum number of simultaneous connections that Prisma might have open to your database. **Default**: `1`.

See the next section to learn how you can configure an SSL connection.

### Configuring an SSL connection

You can add various parameters to the connection string if your database server uses SSL. Here's an overview of the possible parameters:

- `sslmode=(disable|prefer|require)`: 
  - `prefer` (default): Prefer TLS if possible, accept plain text connections. 
  - `disable`: Do not use TLS.
  - `require`: Require TLS or fail if not possible.
- `sslcert=<PATH>`: Path the the server certificate, for Google Cloud this likely is `server-ca.pem`.
- `sslidentity=<PATH>`: Path to the PKCS12 certificate database created from client cert and key.
- `sslpassword=<PASSWORD>`: The PKCS12 password.
- `sslaccept=(strict|accept_invalid_certs)`: 
  - `strict`: Any missing value in the certificate will lead to an error. For Google Cloud, especially if the database doesn't have a domain name, the certificate might miss the domain/IP address, causing an error when connecting.
  - `accept_invalid_certs`: Bypass this check. Be aware of the security consequences of this setting.