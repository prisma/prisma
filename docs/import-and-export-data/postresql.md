# Importing and exporting data with PostgreSQL

This document describes how you can export data from and import data into a PostgreSQL database. You can learn more about this topic in the official [PostgreSQL docs](https://www.postgresql.org/docs/9.1/backup-dump.html).

## Data export with SQL Dump

[SQL Dump](https://www.postgresql.org/docs/9.1/backup-dump.html) is a native PostgreSQL utility you can use to export data from your PostgreSQL database. To see all the options for this command, run `pg_dump --help`.

From the PostgreSQL docs: 

> The idea behind this dump method is to generate a text file with SQL commands that, when fed back to the server, will recreate the database in the same state as it was at the time of the dump. PostgreSQL provides the utility program `pg_dump` for this purpose. 
> `pg_dump` is a regular PostgreSQL client application (albeit a particularly clever one). This means that you can perform this backup procedure from any remote host that has access to the database. But remember that pg_dump does not operate with special permissions. In particular, it must have read access to all tables that you want to back up, so in practice you almost always have to run it as a database superuser.

The command looks like this:

```psql
pg_dump DB_NAME > OUTPUT_FILE
```

You need to replace the `DB_NAME` and `OUTPUT_FILE` placeholders with the respective values for: 

- your **database name**
- the name of the desired **output file** (should end on `.sql`)

For example, to export data from a local PostgreSQL server from a database called `mydb` into a file called `mydb.sql`, you can use the following command:

```
pg_dump mydb > mydb.sql
```

If your database schema uses [Object Idenfitifier Types](https://www.postgresql.org/docs/8.1/datatype-oid.html) (OIDs), you'll need to run `pg_dump` with the `--oids` (short: `-o`) option: `pg_dump mydb --oids > mydb.sql`.

#### Providing database credentials

You can add the following arguments to specify the location of your PostgreSQL database server:

| Argument | Default | Env var | Description |  
| --- | --- | --- | --- |
| `--host` (short: `-h`) | `localhost` | `PGHOST` | The address of the server's host machine | 
| `--port` (short: `-p`) | - | `PGPORT` | The port of the server's host machine where the PostgreSQL server is listening | 
To authenticate against the PostgreSQL database server, you can use the following argument:

| Argument | Default | Env var | Description |  
| --- | --- | --- | --- |
| `--username` (short: `-U`) | _your current operating system user name_ | `PGUSER` | The name of the database user. | 

For example, if you want to export data from a PostgerSQL database that has the following [connection string](../core/connectors/postgresql.md):

```
postgresql://opnmyfngbknppm:XXX@ec2-46-137-91-216.eu-west-1.compute.amazonaws.com:5432/d50rgmkqi2ipus
```

You can use the following `pg_dump` command:

```
pg_dump --host ec2-46-137-91-216.eu-west-1.compute.amazonaws.com --port 5432 --user opnmyfngbknppm d50rgmkqi2ipus > heroku_backup.sql
```

Note that **this command will trigger a prompt where you need to specify the password** for the provided user.

#### Controlling the output

There might be cases where you don't want to dump the _entire_ database, for example you might want to:

- dump only the actual data but exclude the [DDL](https://www.postgresql.org/docs/8.4/ddl.html) (i.e. the SQL statements that define your database schema like `CREATE TABLE`,...)
- dump only the DDL but exclude the actual data
- exclude a specific PostgreSQL schema
- exclude large files
- exclude specic tables

Here's an overview of a few command line options you can use in these scenarios:

| Argument | Default | Description |  
| --- | --- | --- |
| `--data-only` (short: `-a`) | `false` | Exclude any [DDL](https://www.postgresql.org/docs/8.4/ddl.html) statements and export only data. | 
| `--schema-only` (short: `-s`) | `false` | Exclude data and export only [DDL](https://www.postgresql.org/docs/8.4/ddl.html) statements. | 
| `--blobs` (short: `-b`) | `true` unless either `-schema`, `--table`, or `--schema-only` options are specified | Include binary large objects. | 
| `--no-blobs` (short: `-B`) | `false` | Exclude binary large objects. | 
| `--table` (short: `-t`) | _includes all tables by default_ | Explicitly specify the names of the tables to be dumped. | 
| `--exclude-table` (short: `-T`) | - | Exclude specific tables from the dump. | 

## Importing data from SQL files

After having used SQL Dump to export your PostgreSQL database as a SQL file, you can restore the state of the database by feeding the SQL file into [`psql`](https://www.postgresql.org/docs/9.3/app-psql.html):

```
psql DB_NAME < INPUT_FILE
```

You need to replace the `DB_NAME` and `INPUT_FILE` placeholders with the respective values for: 

- your **database name** (a database with hat name must be created beforehand!)
- the name of the target **input file** (likely ends on `.sql`)

To create the database `DB_NAME` beforehand, you can use the [`template0`](https://www.postgresql.org/docs/9.5/manage-ag-templatedbs.html) (which creates a plain user database that doesn't contain any site-local additions):

```sql
CREATE DATABASE dbname TEMPLATE template0;
```
