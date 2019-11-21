# Importing and exporting data with MySQL

This document describes how you can export data from and import data into a MySQL database. You can learn more about this topic in the official [MySQL docs](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html).

## Data export with `mysqldump`

[`mysqldump`](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) is a native MySQL command line utility you can use to export data from your MySQL database. To see all the options for this command, run `mysqldump --help`.

Note that your [MySQL installation](https://dev.mysql.com/doc/refman/8.0/en/installing.html) comes with `mysqldump` by default, typically contained in `/usr/local/mysql/bin` on Mac OS. This means you can either invoke the command by pointing to that directory `/usr/local/mysql/bin/mysqldump` or [adding it to your `PATH`](https://stackoverflow.com/questions/30990488/how-do-i-install-command-line-mysql-client-on-mac#answer-35338119) so that you can run `mysqldump` without specifying the directory.

From the MySQL docs: 

> The `mysqldump` client utility performs logical backups, producing a set of SQL statements that can be executed to reproduce the original database object definitions and table data. It dumps one or more MySQL databases for backup or transfer to another SQL server. The `mysqldump` command can also generate output in CSV, other delimited text, or XML format.

The command looks like this:

```psql
mysqldump DB_NAME > OUTPUT_FILE
```

You need to replace the `DB_NAME` and `OUTPUT_FILE` placeholders with the respective values for: 

- your **database name**
- the name of the desired **output file** (should end on `.sql`)

For example, to export data from a local MySQL server from a database called `mydb` into a file called `mydb.sql`, you can use the following command:

```
mysqldump mydb > mydb.sql
```

#### Providing database credentials

You can add the following arguments to specify the location of your MySQL database server:

| Argument | Default | Description |  
| --- | --- | --- |
| `--host` (short: `-h`) | `localhost` | The address of the server's host machine | 
| `--port` (short: `-p`) | - | The port of the server's host machine where the MySQL server is listening | 

To authenticate against the MySQL database server, you can use the following argument:

| Argument | Default | Description |  
| --- | --- | --- |
| `--user` (short: `-u`) | - | The name of the database user. | 
| `--password` (short: `-p`) | - | Trigger password prompt. | 

For example, if you want to export data from a MySQL database that has the following [connection string](../core/connectors/mysql.md):

```
mysql://opnmyfngbknppm:XXX@ec2-46-137-91-216.eu-west-1.compute.amazonaws.com:5432/d50rgmkqi2ipus
```

You can use the following `mysqldump` command:

```
mysqldump --host ec2-46-137-91-216.eu-west-1.compute.amazonaws.com --port --user opnmyfngbknppm --password d50rgmkqi2ipus > backup.sql
```

Note that **this command will trigger a prompt where you need to specify the password** for the provided user.

#### Controlling the output

There might be cases where you don't want to dump the _entire_ database, for example you might want to:

- dump only the actual data but exclude the [DDL](https://www.postgresql.org/docs/8.4/ddl.html) (i.e. the SQL statements that define your database schema like `CREATE TABLE`,...)
- dump only the DDL but exclude the actual data
- exclude specic tables

Here's an overview of a few command line options you can use in these scenarios:

| Argument | Default | Description |  
| --- | --- | --- |
| `--no-create-db` (short: `-n`) | `false` | Exclude any [DDL](https://www.postgresql.org/docs/8.4/ddl.html) statements and export only data. | 
| `--no-data` (short: `-d`) | `false` | Exclude data and export only [DDL](https://www.postgresql.org/docs/8.4/ddl.html) statements. | 
| `--tables`| _includes all tables by default_ | Explicitly specify the names of the tables to be dumped. | 
| `--ignore-table` | - | Exclude specific tables from the dump. | 

## Importing data from SQL files

After having used `mysqldump` to export your MySQL database as a SQL file, you can restore the state of the database by feeding the SQL file into [`mysql`](https://dev.mysql.com/doc/refman/8.0/en/mysql.html):

```
mysql DB_NAME INPUT_FILE
```

Note that your [MySQL installation](https://dev.mysql.com/doc/refman/8.0/en/installing.html) comes with `mysql` by default, typically contained in `/usr/local/mysql/bin` on Mac OS. This means you can either invoke the command by pointing to that directory `/usr/local/mysql/bin/mysmysqlqldump` or [adding it to your `PATH`](https://stackoverflow.com/questions/30990488/how-do-i-install-command-line-mysql-client-on-mac#answer-35338119) so that you can run `mysql` without specifying the directory.

You need to replace the `DB_NAME` and `INPUT_FILE` placeholders with the respective values for: 

- your **database name** (a database with hat name must be created beforehand!)
- the name of the target **input file** (likely ends on `.sql`)

For example:

```
mysql mydb < mydb.sql
```

To authenticate, you can use the `--user` and `--password` options discussed above:

```
mysql --user root --password mydb < mydb.sql
```

To create a database beforehand, you can use the following SQL statement:

```sql
CREATE DATABASE mydb;
```



