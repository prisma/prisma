<p align="center"><a href="https://lift.prisma.io/"><img src="logo.svg" alt="Prisma" height="40px"></a></p>

<br />

<!--<p><h1 align="center">Prisma Migrate</h1></p>-->
<p><h3 align="center">Declarative data modeling & database migrations</h3></p>

<p align="center">
  <a href="#getting-started">Get started</a> • <a href="#features">Features</a> • <a href="#docs">Docs</a> • <a href="#the-prisma-migrate-workflow">Workflow</a> • <a href="#supported-databases">Supported databases</a>
</p>

<hr />

**Prisma Migrate** is a powerful database schema migration tool. It uses a **declarative [data modelling](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md) syntax** to describe your database schema. Prisma Migrate also stores your entire **migration history** and easily lets you **revert and replay migrations**. When migrating your database with Prisma Migrate, you can run provide **before- and after-hooks** to execute scripts, e.g. to populate the database with required values during a migration.

> **WARNING**: Prisma Migrate is currently in an **experimental** state. The version available has a number of [limitations](https://github.com/prisma/prisma2/blob/master/docs/limitations.md) that make it unsuitable for production workloads, including missing features, limited performance and stability issues.

<p align="center">
  <!-- <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a> -->
  <a href="https://www.github.com/prisma/prisma2/"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

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

You can find comprehensive documentation for Prisma Migrate in the [Prisma 2 docs](https://github.com/prisma/prisma2/).

## The Prisma Migrate workflow

### 1. Configure database access

<img src="https://i.imgur.com/UcN3ENI.png" width="220px">

Specify the connection details for your database as a _data source_ in your [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). The connection details might differ per database, but most commonly you'll provide the following:

- Host: The IP address or domain name of the machine where your database server is running.
- Port: The port on which your database server is listening.
- User & password: Credentials for your database server.

Here is an example project file that connects to a local PostgreSQL database:

```prisma
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator client {
  provider = 'prisma-client-js'
}
```

### 2. Define initial data model

The [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) is a declarative and human-readable representation of your database schema. Here is the project file from above extended with a sample data model:

```prisma
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator client {
  provider = 'prisma-client-js'
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

#### Option A: Starting with an existing database

<img src="https://i.imgur.com/XkRkwdE.png" width="355px">

If you want to use Prisma Migrate with an existing database, you can [introspect](https://github.com/prisma/prisma2/blob/master/docs/introspection.md) your database schema using the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md). This generates a declarative [data model](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) which provides the foundation for future migrations.

#### Option B: Start from scratch

When starting from scratch, you can write your own [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) inside your [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). You can then use the Prisma Migrate CLI commands to migrate your database (Prisma Migrate maps your data model definition to the schema of the underlying database).

### 3. Adjust the data model

<img src="https://i.imgur.com/ePrrlHP.png" width="387px">

Instead of sending SQL migration statements to the database, you need to adjust the data model file to describe your desired database schema. You can express any schema migration you like using the new data model, this includes for example adding a new model, removing a model or updating the fields of a model. You can
also add indexes or validation constraints in the data model.

You can create a new migration for your change by running `prisma2 migrate save`:

```bash
prisma2 migrate save --name "add-comment-model" --experimental
```

### 4. Migrate your database (apply data model changes)

<img src="https://i.imgur.com/L6a5Vqd.png" width="392px">

Once you're happy with the changes, you can use the Prisma CLI to migrate your database (i.e. map the adjusted data model to your database). Prisma Migrate's migration engine will generate the corresponding SQL statements and send them to the database for you.

```bash
prisma2 migrate up --experimental
```

## Supported databases

Prisma Client JS can be used with the following databases:

- MySQL
- PostgreSQL
- MongoDB (_coming very soon_)

More databases that will be supported in the future are:

- MS SQL
- Oracle
- Neo4J
- FaunaDB
- ...

## Contributing

Read more about how to contribute to Prisma Migrate [here](https://github.com/prisma/migrate/blob/master/CONTRIBUTING.md)

[![Build status](https://badge.buildkite.com/9caba29c5511a465e0cbf0f6b2f62173145d3dd90cf56c4daf.svg)](https://buildkite.com/prisma/lift)
