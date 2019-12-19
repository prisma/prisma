# Errors

- [Common]() (P1XXX)
- [Query engine]() (P2XXX)
- [Migration engine]() (P3XXX)

## Common

### P1000 Authentication failed

This error occurs when Prisma can connect to your database server but is unable to authenticate based on the provided user credentials. 

#### Error message

```
Authentication failed against database server at `${database_host}`, the provided database credentials for `${database_user}` are not valid.
Please make sure to provide valid database credentials for the database server at `${database_host}`."
```

#### How to fix

Top fix the error, be sure to provide valid connection details and credentials for your database server. You can find more info about connecting to the database in the docs for the respective database connector:

- [MySQL](./core/connectors/mysql.md)
- [PostgeSQL](./core/connectors/postgresql.md)

#### P1001 Cannot reach database server

This error occurs when Prisma is unable to connect to your database server.

#### Error message

```
Can't reach database server at `${database_host}`:`${database_port}`
Please make sure your database server is running at `${database_host}`:`${database_port}`."
```

#### How to fix

There are two potential reasons to this error:

- The database server is not runnning
- The provided connection details (host and port) are incorrect

To fix the error, be sure that your database server is running at the provided location.

You can find more info about connecting to the database in the docs for the respective database connector:

- [MySQL](./core/connectors/mysql.md)
- [PostgeSQL](./core/connectors/postgresql.md)

### P1002 Database server timed out

This error occurs when Prisma reaches your database server but receives a timeout and therefore is unable to establish a connection to it.

#### Error message

```
The database server at `${database_host}`:`${database_port}` was reached but timed out.
Please try again.
Please make sure your database server is running at `${database_host}`:`${database_port}`.
```

#### How to fix

To fix this error, you can retry the operation a few times. If neither of following attempts succeed, you can check the logs of your database server to see what might be causing the timeout. Another option to resolve this issue is by increasing the timeout period on of your database server

Find more info in the docs for the respective database docs:

- MySQL
  - [Server Logs](https://dev.mysql.com/doc/refman/8.0/en/server-logs.html)
  - [Replication Retries and Timeouts](https://dev.mysql.com/doc/refman/8.0/en/replication-features-timeout.html)
- PostgreSQL
  - [Error Repoorting and Logging](https://www.postgresql.org/docs/9.1/runtime-config-logging.html)
  - [Client Connection Defaults](https://www.postgresql.org/docs/9.6/runtime-config-client.html)

You can find more info about connecting to the database in the docs for the respective database connector:

- [MySQL](./core/connectors/mysql.md)
- [PostgeSQL](./core/connectors/postgresql.md)

### P1003 Database does not exist

This error occurs when Prisma successfully connects to your database server, but the _database_ itself doesn't exist on that server.

#### Error message

**SQLite**

```
Database ${database_file_name} does not exist on the database server at ${database_file_path}
```

**PostgreSQL**

```
Database `${database_name}.${database_schema_name}` does not exist on the database server at `${database_host}:${database_port}`.
```

**MySQL**

```
Database `${database_name}` does not exist on the database server at `${database_host}:${database_port},
```

#### How to fix

To fix this issue, you need to ensure that the database you want to connect to actually exists on the server. You can find more info about creating databases in the docs of the respective database vendor:

- [MySQL](https://dev.mysql.com/doc/refman/8.0/en/creating-database.html)
- [PostgeSQL](https://www.postgresql.org/docs/9.0/sql-createdatabase.html)

You can find more info about connecting to the database in the docs for the respective database connector:

- [MySQL](./core/connectors/mysql.md)
- [PostgeSQL](./core/connectors/postgresql.md)

### P1004 Incompatible binary

This error occurs when your Prisma version tries to use a _binary_ that's incompatible with it. A binary is the executable version of an [engine](https://github.com/prisma/prisma-engine) that is responsible for a certain part of Prisma's functionality. Here's an overview of the engines that currently exist:

- Query engine: Generates database queries based on incoming request (e.g. from Photon)
- Migration engine: Generates database migrations and runs them against the database 
- Introspection engine: Reads the schema of an existing database and generates a [Prisma schema](./prisma-schema-file.md)
- Prisma Format: Reads and formats a [Prisma schema](./prisma-schema-file.md)

#### Error message

```
The downloaded/provided binary `${binary_path}` is not compiled for platform `${platform}`"
```

#### How to fix

To fix this, you can uninstall and reinstall the `prisma2` CLI. If the error occured in the context of Photon.js, the query engine binary that's stored alongside the generated Photon.js code might have the wrong version. In that case, you can do the following:

1. Delete your `node_modules` folder: `rm -rf node_modules`
1. Re-install dependencies: `npm install`
1. Re-generate Photon.js (if necessary): `prisma2 generate`

### P1005 Unable to spawn binary process

This error occurs when Prisma is unable to start an engine.

#### Error message

```
Failed to spawn the binary `${binary_path}` process for platform `${platform}`
```

#### How to fix

To fix this, you can uninstall and reinstall the `prisma2` CLI. If the error occured in the context of Photon.js, the query engine binary that's stored alongside the generated Photon.js code might have the wrong version. In that case, you can do the following:

1. Delete your `node_modules` folder: `rm -rf node_modules`
1. Re-install dependencies: `npm install`
1. Re-generate Photon.js (if necessary): `prisma2 generate`

### P1006 Binary not found

This error occurs when your Prisma version tries to use a _binary_ that's incompatible with it. A binary is the executable version of an [engine](https://github.com/prisma/prisma-engine) that is responsible for a certain part of Prisma's functionality. Here's an overview of the engines that currently exist:

- Query engine: Generates database queries based on incoming request (e.g. from Photon)
- Migration engine: Generates database migrations and runs them against the database 
- Introspection engine: Reads the schema of an existing database and generates a [Prisma schema](./prisma-schema-file.md)
- Prisma Format: Reads and formats a [Prisma schema](./prisma-schema-file.md)

#### Error message

```
Photon binary for current platform `${platform}` could not be found. Make sure to adjust the generator configuration in the schema.prisma file.
${generator_config}
Please run prisma2 generate for your changes to take effect.
```

#### How to fix

To fix this, you can uninstall and reinstall the `prisma2` CLI. If the error occured in the context of Photon.js, the query engine binary that's stored alongside the generated Photon.js code might have the wrong version. In that case, you can do the following:

1. Delete your `node_modules` folder: `rm -rf node_modules`
1. Re-install dependencies: `npm install`
1. Re-generate Photon.js (if necessary): `prisma2 generate`

### P1007 Missing write access

This error occurs when you're trying to install the Prisma 2 CLI but don't have the correct access rights on your operating system to do that. 

#### Error message

```
Please try installing Prisma 2 CLI again with the `--unsafe-perm` option. 
Example: `npm i -g --unsafe-perm prisma2`
```

#### How to fix

Re-install the Prisma 2 CLI with npm's [`--unsafe-perm`](https://geedew.com/What-does-unsafe-perm-in-npm-actually-do/) option:

```
npm install -g --unsafe-perm prisma2
```

### P1008 Database operation timed out

This error occurs when Prisma has connected successfully to you database server and sends an operation to it which times out.

#### Error message

```
Operations timed out after `${time}`"
```

#### How to fix

To fix this error, you can retry the operation a few times. If neither of following attempts succeed, you can check the logs of your database server to see what might be causing the timeout. Another option to resolve this issue is by increasing the timeout period on of your database server

Find more info in the docs for the respective database docs:

- MySQL
  - [Server Logs](https://dev.mysql.com/doc/refman/8.0/en/server-logs.html)
  - [Replication Retries and Timeouts](https://dev.mysql.com/doc/refman/8.0/en/replication-features-timeout.html)
- PostgreSQL
  - [Error Repoorting and Logging](https://www.postgresql.org/docs/9.1/runtime-config-logging.html)
  - [Client Connection Defaults](https://www.postgresql.org/docs/9.6/runtime-config-client.html)

### P1009 Database already exists

This error occurs when Prisma has successfully connected to your database server and tries to create a database with a name that already exists on that server.

#### Error message

```
Database `${database_name}` already exists on the database server at `${database_host}:${database_port}`
```

#### How to fix

To fix this, you can either delete or rename the existing database or choose a different name for the database to be created.

### P1010 

This error occurs when your database user doesn't have the correct access right for the requested operation.

#### Error message

```
User `${database_user}` was denied access on the database `${database_name}`.
```

#### How to fix

To fix this, you can change the rights of your current database user or authenticate with a different user that has the correct access rights for the requested operation.

You can find more info in the respective database docs:

- [MySQL](https://dev.mysql.com/doc/refman/5.7/en/access-control.html)
- [PostgreSQL](https://www.postgresql.org/docs/6.5/security13618.htm)

### P1011

This error occurs when Prisma is unable to establish a [TLS connection](https://en.wikipedia.org/wiki/Transport_Layer_Security) to your database server.

#### Error message

```
Error opening a TLS connection: ${message}
```

#### How to fix

TBD


## Query engine

### P2000

This error occurs when you're creating a new record in the database (e.g. via Photon) and provide a string value that's too long for its respective column type. For example, when you're using a `VARCHAR(10)` type in your database and when setting the value for an entry in this column, you provide a string that contains more than 10 characters. 

#### Error message

```
The value ${field_value} for the field ${field_name} is too long for the field's type
```

#### How to fix

To fix this, you can either shorten the input string that caused the error or change the type of the database column to allow for larger values:

```sql
ALTER TABLE table_name
ALTER COLUMN column_name VARCHAR(n);
```

### P2001

This error occurs when a record when the query engine looks up a record based on a provided filter condition but this record does not exist in the database.

#### Error message

```
The record searched for in the where condition (`${model_name}.${argument_name} = ${argument_value}`) does not exist"
```

#### How to fix

To fix this, be sure that the requested record actually exists in the database.

---

### P2002

This error occurs when you're trying to set a value of a _unique_ field to a value that already exists for that column in the database. For example, if you have the following data model:

```prisma
model User {
  id    Int     @id
  email String  @unique
}
```

You cannot set the value for `email` of two distinct records to the same value, e.g. `"alice@prisma.io"`.

#### Error message

```
Unique constraint failed on the field: `${field_name}`
```

#### How to fix

To fix this, you can either change the value for the unique field that you tried to set or change the existing value that would have been duplicated.
