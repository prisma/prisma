# Errors

## Common

### P1000 – Authentication failed

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

#### P1001 – Cannot reach database server

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

### P1002 – Database server timed out

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

## Introspection

## Migration engine

## Query engine