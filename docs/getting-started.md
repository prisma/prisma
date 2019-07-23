# Getting started

The easiest way to get started with Photon and/or Lift is by installing the Prisma CLI and running the interactive `init` command:

```
npm install -g prisma2
prisma2 init hello-prisma
```

> Lift and Photon are currently in Preview! [Limitations](https://github.com/prisma/prisma2/blob/master/docs/limitations.md) include missing features, limited performance and stability issues.

## The `prisma init` flow

### 1. Database selection 

The first step asks you which kind of database you want to use with Photon/Lift. Currently, the following databases are supported:

- **SQLite**
- **MySQL**
- **PostgreSQL**
- MongoDB (coming soon)

> When choosing **SQLite**, you can either point the Prisma CLI to an existing SQLite database file or let it create a new database file for you. With **all other options**, you'll need to provide the database connection details and credentials in the next step. 

### 2. Database credentials

#### For SQLite

Let the Prisma CLI create a new SQLite database file for you or select an existing one to introspect.

#### For all other options

Please provide the database connection details for your database server. If the Prisma CLI can successfully connect to your database server, it prompts you with the following options:

- Select an existing, non-empty database/schema to introspect
- Select an existing empty database/schema to get started from scratch
- Create empty database/schema to get started from scratch

> For MySQL and MongoDB servers, the you need to select a **database**. For PostgreSQL, it's called a **schema**.

### 3. Selecting Prisma tools (Photon/Lift)

At this point, you have three options to use the Prisma tools with your successfully connected database:

- Use Photon and Lift
- [Use only Photon](./photon/use-only-photon.md) (for database access (ORM))
- [Use only Lift](./lift/use-only-lift.md) (for database migrations)

> If you select **only Photon** or **only Lift**, it will still be possible to add the other tool to your project later.

### 4. Language selection (only Photon)

If your previous selection included Photon, you're now prompted for the language in which you want to access your database. Currently Photon is available in the following languages:

- **JavaScript**
- **TypeScript**
- Go (coming soon)

### 5. Boilerplate selection (only Photon)

Finally, you can decide how your initial project setup should look like:

- **From scratch**: Sets up a greenfield project demonstrating usage of Photon in a simple script
- **GraphQL boilerplate**: Sets up a GraphQL server example based on Photon
- **REST boilerplate**: Sets up a REST API example based on Photon
- **gRPC boilerplate**: Sets up a gRPC server example based on Photon

## Installing the Prisma CLI


### NPM

```
npm install -g prisma2
```

### Yarn

```
yarn global add prisma2
```
