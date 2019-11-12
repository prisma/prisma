# Importing and exporting data with SQLite

This document describes how you can export data from and import data into a SQLite database. You can learn more about this topic in the official [SQLite docs](https://www.sqlitetutorial.net/sqlite-dump/).

## Data export with `sqlite3`

[`sqlite3`](https://www.sqlite.org/cli.html) is a native SQLite command line utility you can use for various workflows accross your SQLite database. To see all the options for this command, run `sqlite3 --help`. Exporting data is typically done with the `.dump` command within the `sqlite3` prompt.

To export data, you need to enter the `sqlite3` prompt and point it to the location of your SQLite database file (ends on `.db`):

```
sqlite3 ./dev.db
```

Once you're in the prompt, you can export data as follows:

```
sqlite> .output ./backup.sql
sqlite> .dump
sqlite> .exit
```

Alternatively, you can export a specific table by adding the table name after the `.dump` command in the prompt. For example the following command only dumps the `users` table:

```
sqlite> .output ./backup_users.sql
sqlite> .dump users
sqlite> .exit
```

If you want to exclude all data and only export the _database schema_ ([DDL](https://en.wikipedia.org/wiki/Data_definition_language)), you can use `.schema` instead of `.dump`:

```
sqlite> .output ./backup_schema.sql
sqlite> .schema
sqlite> .exit
```

## Importing data from SQL files

After having used the `.dump` command insinde the `sqlite3` prompt to export your SQLite database as a SQL file, you can restore the state of the database by feeding the SQL file back into `sqlite3` using the `.read` command.

Before you can use the `.read` command, you need to enter the `sqlite3` prompt and point it to your SQLite database file:

```
sqlite3 ./restore.db
```

Now you can import the data from your SQL files as follows:

```
.read ./backup.sql
.exit
```
