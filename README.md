<br />
<p align="center"><img src="logo.svg" alt="Prisma" height="40px"></p>

<p><h3 align="center">Type-safe database client for TypeScript & Node.js (ORM replacement)</h3></p>

<p align="center">
  <a href="#getting-started">Get started</a> • <a href="#features">Features</a> • <a href="#docs">Docs</a> • <a href="#api-examples">API</a> • <a href="#the-prisma-client-js-workflow">Workflow</a> • <a href="#supported-databases">Supported databases</a>
</p>

<hr>

Prisma Client JS is an **auto-generated database client** that enables **type-safe** database access and **reduces boilerplate**. You can use it as an alternative to traditional ORMs such as Sequelize, TypeORM or Knex.js.

It is part of the [Prisma 2](https://www.github.com/prisma/prisma2) ecosystem. Prisma 2 provides database tools for data access, declarative data modeling, schema migrations and visual data management. Learn more in the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/).

> Note that Prisma Client JS is currently running in Preview. A productionn-ready release is [planned for Q1 2020](https://www.prisma.io/blog/state-of-prisma-2-december-rcrwcqyu655e/).

<br />

<p align="center">
  <!-- <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a> -->
  <a href="https://www.github.com/prisma/prisma2"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

## Getting started

The easiest way to get started with Prisma Client JS is by installing the Prisma 2 CLI and running the `init` command:

```sh
npm install -g prisma2
mkdir my-prisma-project && cd my-prisma-project
prisma2 init
```

Learn more about the `prisma2 init` flow [here](https://pris.ly/d/getting-started).

## Features

- Auto-generated database client
- Fully **type-safe** data access API (even for JavaScript), including:
  - Field selection, lazy/eager loading
  - Fluent API to traverse relations
  - Transactional nested writes and batching API
  - Relation filters (filter on JOINed tables)
  - Powerful methods for filtering, sorting and (cursor) pagination
- Declarative data modelling and migrations with [Prisma Migrate](https://github.com/prisma/migrate)
- Connection pooling
- Works with existing databases using schema introspection
- CLI to support all major workflows
- Integrates seamlessly in your npm projects (without `npm install`)

## Docs

You can find comprehensive documentation for Prisma Client JS in the [Prisma 2 docs](https://github.com/prisma/prisma2).

## API examples

Here are few example API calls:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.connect()

  const userById = await prisma.users.findOne({ where: { id: 1 } })
  const userByEmail = await prisma.users.findOne({ where: { email: "ada@prisma.io" }})

  const userWithPosts = await prisma.users.findOne({
    where: { email: "ada@prisma.io" },
    include: { posts: { first: 10 } },
  })

  const newUser = await prisma.users.create({ data: {
    name: "Alice",
    email: "alice@prisma.io",
  }})

  const newUserWithPosts = await prisma.users.create({ data: {
    email: "alice@prisma.io",
    posts: {
      create: [
        { title: "Join us for Prisma Day. June 19, Berlin!" },
        { title: "Follow Prisma on Twitter!" },
      ]
    }
  }})

  const updatedUser = await prisma.users.update({
    where: { email: "alice@prisma.io" },
    data: { role: "ADMIN" },
  })
}

main().catch(e => {
  console.error(e)
}).finally(async () => {
  await prisma.disconnect()
})
```

<Details><Summary>Expand to the view the <strong>data model</strong> based on which the above Prisma Client JS API was generated</Summary>

```prisma
datasource ds {
  // some data source config, e.g. SQLite, PostgreSQL, ...
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id         Int       @id @default(autoincrement())
  email      String    @unique
  name       String
  posts      Post[]
}

model Post {
  id          Int       @id  @default(autoincrement())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  draft       Boolean   @default(true)
  author      User
}
```

Learn more about the data model in the [docs](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md).

</Details>

You can learn more about Prisma Client's API features in the [API reference](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md).

## The Prisma Client JS workflow

### 1. Configure data source

<img src="https://i.imgur.com/UcN3ENI.png" width="220px">

Specify the connection details for your database as a _data source_ in your [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). The connection details might differ per database, but most commonly you'll provide the following:

- Host: The IP address or domain name of the machine where your database server is running.
- Port: The port on which your database server is listening.
- User & password: Credentials for your database server.

Here is an example schema file that connects to a local PostgreSQL database:

```prisma
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432/mydb"
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}
```

### 2. Define initial data model

The [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) is a declarative and human-readable representation of your database schema. Here is the schema file from above extended with a sample data model:

```prisma
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
}

model Post {
  id         Int        @id @default(autoincrement())
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  title      String
  published  Boolean    @default(false)
  author     User
}

enum Role {
  USER
  ADMIN
}
```

Read below to learn how you obtain it for your project.

#### Option A: Starting with an existing database (_brownfield_)

<img src="https://i.imgur.com/XkRkwdE.png" width="355px">

If you want to use Prisma Client JS with an existing database, you can [introspect](https://github.com/prisma/prisma2/blob/master/docs/introspection.md) your database schema using the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md). This generates a [data model](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) which is the foundation for the generated Prisma Client JS API.

#### Option B: Start from scratch (_greenfield_)

When starting from scratch, you can simply write your own [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) inside your [schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). You can then use [Prisma Migrate](https://github.com/prisma/migrate) to migrate your database (Prisma Migrate maps your data model definition to the schema of the underlying database).

### 3. Generate Prisma Client JS

<img src="https://i.imgur.com/rdtKEYL.png" width="453px">

Generate your version of Prisma Client JS using the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md):

```sh
prisma2 generate
```

Prisma Client JS is generated based on the [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) and provides a type-safe API with the following features:

- CRUD
- Filter, sorting and (cursor) pagination
- Field selection and eager loading
- Relations and transactions
- Raw database access

Prisma Client JS gets generated into your `node_modules` folder so you can import it directly from `'@prisma/client'`. There's no need to install any additional dependencies or database drivers.

### 4. Build an app

Similar to traditional ORMs, Prisma Client JS can be used with any of your Node.js or TypeScript applications. For example to implement REST, GraphQL or gRPC APIs. You can find reference examples for these use cases in the [`prisma-examples`](https://github.com/prisma/prisma-examples/tree/prisma2) repository.

### 5. Evolve your database and Prisma Client JS

As you build your app, you'll likely migrate your database to implement new features. Depending on how you obtained your [initial data model](#2-define-initial-data-model) and whether or not you're using [Prisma Migrate](https://github.com/prisma/migrate), there might be two ways for evolving your application going forward.

#### Option A: Without Prisma Migrate

If you're not using Prisma Migrate, you need to re-introspect your database (to update the generated datamodel) and re-generate Prisma Client JS after each schema migration:

```sh
prisma2 introspect
prisma2 generate
```

#### Option B: With Prisma Migrate

When using Prisma Migrate, you need to re-generate Prisma Client JS immediately after you performed a schema migration:

```sh
# adjust data model definition in schema.prisma
prisma2 migrate save --experimental
prisma2 migrate up --experimental
prisma2 generate
```

## Supported databases

Prisma Client JS can be used with the following databases:

- SQLite
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

Read more about how to contribute to Prisma Client JS [here](https://github.com/prisma/prisma-client-js/blob/master/CONTRIBUTING.md)

[![Build status](https://badge.buildkite.com/fa6027d11848231f2bc194aaffcf5dbc2ee0a83d666af0806e.svg)](https://buildkite.com/prisma/photon)
