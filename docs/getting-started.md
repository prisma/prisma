# Getting started

The quickest way to get started with Photon and/or Lift is by installing the Prisma CLI and running the interactive `init` command:

```
npm install -g prisma2
prisma2 init hello-prisma
```

> **Note**: Lift and Photon are currently in Preview! [Limitations](https://github.com/prisma/prisma2/blob/master/docs/limitations.md) include missing features and limited performance issues.

## The `prisma2 init` flow

When running `prisma2 init`, the Prisma 2 CLI launches an **interactive wizard** that helps you get started with Photon and/or Lift.

The following sections explain a few screens you might encounter as you run through the `prisma2 init` flow. Because the flow and the order of the screens vary depending on your selections, the screens below might not follow the order in which you encounter them. 

### Blank project vs Starter kits

At first, the wizard prompts you to select either of two options:

- **Blank project**: Blank projects can be used when you want to start a new project from scratch. This option also supports introspecting an existing database.
- **Starter kit**: Starter kits provide runnable examples for various use cases, they're based on the example projects in the [`prisma-examples`](https://github.com/prisma/prisma-examples/tree/prisma2) repository. The wizard will help you connect a starter kit to your own database. Note that starter kits can only be used in _empty directories_ and with _empty databases_. If you don't have a database running, you can select **SQLite**.

### Database selection

Later, the wizard asks you which kind of database you want to use with Photon/Lift. Currently, the following databases are supported:

- **SQLite**
- **MySQL**
- **PostgreSQL**
- MongoDB (coming soon)

Note that both, **MySQL** and **PostgreSQL** options, required you to run a database that you can connect to in the next step. If you don't have a database running, choose **SQLite** and let the wizard create a new SQLite database file for you.

### Database credentials

After having selected **MySQL** or **PostgreSQL** in the database selection, you need to provide the database connection details and user credentials for your database server. Check out the [MySQL](./core/connectors/mysql.md) and [PostgreSQL](./core/connectors/postgresql.md) connector docs to learn about the connection string format and the required info.

### Selecting Prisma tools (Photon/Lift)

If you start with an existing database and the Prisma 2 CLI performed introspection against it to generate the [Prisma schema](./prisma-schema.md), you will be asked to select which Prisma tools you want to use:

- Use Photon and Lift
- [Use only Photon](./photon/use-only-photon.md) (for database access (ORM))
- [Use only Lift](./lift/use-only-lift.md) (for database migrations)

> **Note**: If you select **only Photon** or **only Lift**, it will still be possible to add the other tool to your project later.

### Language selection

If you're starting with a new database or are using a starter kit, you're prompted for the language in which you want to access your database. Currently Photon is available in the following languages:

- **JavaScript**
- **TypeScript**
- Go (coming soon)

## Installing the Prisma CLI

### NPM

```
npm install -g prisma2
```

### Yarn

```
yarn global add prisma2
```
