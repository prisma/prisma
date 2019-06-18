<p align="center"><a href="https://www.prisma.io"><img src="https://imgur.com/BDWqDoo.png" alt="Prisma" height="66px"></a></p>

<!--<p><h1 align="center">Lift</h1></p>-->
<p><h3 align="center">Declarative data modeling & database migrations</h3></p>

<p align="center">
  <a href="#getting-started">Get started</a> • <a href="#features">Features</a> • <a href="#docs">Docs</a> • <a href="#the-lift-workflow">Workflow</a> • <a href="#supported-databases">Supported databases</a>
</p>

<hr />

[Lift](https://lift.prisma.io/) is a powerful database schema migration tool. It uses a **declarative [data modelling](https://github.com/prisma/prisma2-docs/blob/master/data-modeling.md) syntax** to describe your database schema. Lift stores your entire **migration history** and easily lets you **revert and replay migrations**. When migrating your database with Lift, you can run provide **before- and after-hooks** to execute scripts, e.g. to populate the database with required values during a migration.

It is part of the [Prisma 2](https://www.github.com/prisma/prisma2-docs) ecosystem. Prisma 2 provides database tools for data access, declarative data modeling, schema migrations and visual data management. Learn more in the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/).

<p align="center">
  <!-- <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a> -->
  <a href="https://www.github.com/prisma/prisma2-docs/"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

## Getting started

The easiest way to get started with Lift is by installing the Prisma 2 CLI and running the interactive `init` command:

```
npm install -g prisma2
prisma2 init hello-prisma
```

The interactive prompt will ask you to provide database credentials for your database. If you don't have a database yet, select **SQLite** and let the CLI set up a database file for you.

Learn more about the `prisma2 init` flow [here](https://github.com/prisma/prisma2-docs/blob/master/getting-started.md).

## Features

- Declarative data modelling syntax
- Supports relational and document databases (more coming soon)
- Keeps a migration history
- Before- and after hooks to run scripts for complex migrations
- Simple defaults, optional complexity for advanced use cases
- Revert and replay migrations
- Works with existing databases using schema introspection
- CLI to support all major workflows

## Docs

You can find comprehensive documentation for Lift in the [Prisma 2 docs](https://github.com/prisma/prisma2-docs/).

## The Lift workflow

### 1. Configure database access

<img src="https://i.imgur.com/UcN3ENI.png" width="220px">

Specify the connection details for your database as a _data source_ in your [Prisma project file](https://github.com/prisma/prisma2-docs/blob/master/prisma-project-file.md). The connection details might differ per database, but most commonly you'll probide the following:

- Host: The IP address or domain name of the machine where your database server is running.
- Port: The port on which your database server is listening.
- User & password: Credentials for your database server.

Here is an example project file that connects to a local PostgreSQL database: 

```groovy
// project.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator photonjs {
  provider = 'photonjs'
}
```

### 2. Define initial data model

The [data model definition](https://github.com/prisma/prisma2-docs/blob/master/data-modeling.md#data-model-definition) is a declarative and human-readable representation of your database schema. Here is the project file from above extended with a sample data model:

```groovy
// project.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator photonjs {
  provider = 'photonjs'
}

model User {
  id        Int      @id
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
}

model Post {
  id         Int        @id
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  author     User
  title      String
  published  Boolean    @default(false)
}

enum Role {
  USER
  ADMIN
}
```

#### Option A: Starting with an existing database (_brownfield_)

<img src="https://i.imgur.com/XkRkwdE.png" width="355px">

If you want to use Lift with an existing database, you can [introspect](https://github.com/prisma/prisma2-docs/blob/master/introspection.md) your database schema using the [Prisma 2 CLI](https://github.com/prisma/prisma2-docs/blob/master/prisma-2-cli.md). This generates a declarative [data model](https://github.com/prisma/prisma2-docs/blob/master/data-modeling.md#data-model-definition) which provides the foundation for future migrations. 

#### Option B: Start from scratch (_greenfield_)

When starting from scratch, you can simply write your own [data model definition](https://github.com/prisma/prisma2-docs/blob/master/data-modeling.md#data-model-definition) inside your [project file](https://github.com/prisma/prisma2-docs/blob/master/prisma-project-file.md). You can then use the Lift CLI commands to migrate your database (Lift maps your data model definition to the schema of the underlying database).

### 3. Adjust the data model

<img src="https://i.imgur.com/ePrrlHP.png" width="387px">

Instead of sending SQL migration statements to the database, you need to adjust the data model file to describe your desired database schema. You can express any schema migration you like using the new data model, this includes for example adding a new model, removing a model or updating the fields of a model. You can
also add indexes or validation constraints in the data model.

You can create a new migration for your change by running `prisma lift save`:

```bash
prisma lift save --name "add-comment-model"
```

### 4. Migrate your database (apply data model changes)

<img src="https://i.imgur.com/L6a5Vqd.png" width="392px">

Once you're happy with the changes, you can use the Prisma CLI to migrate you database (i.e. map the adjusted data model to your database). Lift's migration engine will generate the corresponding SQL statements and send them to the database for you.

```bash
prisma lift up
```

## Supported databases

Photon JS can be used with the following databases:

- MySQL
- PostgreSQL
- MongoDB (_coming very soon_)

More databases that will be supported in the future are:

- MS SQL
- Oracle
- Neo4J
- FaunaDB
- ...
