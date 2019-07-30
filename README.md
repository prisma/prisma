<br />
<p align="center"><a href="https://photonjs.prisma.io/"><img src="logo.svg" alt="Prisma" height="40px"></a></p>

<!-- <p><h1 align="center">Photon JS</h1></p> -->
<p><h3 align="center">Type-safe database client for TypeScript & Node.js (ORM replacement)</h3></p>

<p align="center">
  <a href="#getting-started">Get started</a> • <a href="#features">Features</a> • <a href="#docs">Docs</a> • <a href="#api-examples">API</a> • <a href="#the-photon-js-workflow">Workflow</a> • <a href="#supported-databases">Supported databases</a>
</p>

<!--
<p align="center">
  <a href="https://circleci.com/gh/prisma/prisma"><img src="https://circleci.com/gh/prisma/prisma.svg?style=shield" alt="CircleCI"></a>
  <a href="https://slack.prisma.io"><img src="https://slack.prisma.io/badge.svg" alt="Slack"></a>
  <a href="https://spectrum.chat/prisma"><img src="https://withspectrum.github.io/badge/badge.svg" alt="Spectrum"></a>
</p>
-->

<hr>

[Photon JS](https://photonjs.prisma.io/) is an **auto-generated database client** that enables **type-safe** database access and **reduces boilerplate**. You can use it as an alternative to traditional ORMs such as Sequelize, TypeORM or Knex.js

It is part of the [Prisma 2](https://www.github.com/prisma/prisma2) ecosystem. Prisma 2 provides database tools for data access, declarative data modeling, schema migrations and visual data management. Learn more in the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/).

> Note that Photon JS is currently running in Preview. The version available has severe [limitations](https://github.com/prisma/prisma2/blob/master/docs/limitations.md) that make it unsuitable for production workloads, including missing features, limited performance and stability issues. We will address all these limitations before issuing a stable release later this year.

<br />

<p align="center">
  <!-- <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a> -->
  <a href="https://www.github.com/prisma/prisma2"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

<!-- <p align="center">
  Or try an online <a href="https://codesandbox.io/s/github/prisma-csb/graphql-example-ts">GraphQL API</a> or <a href="https://codesandbox.io/s/github/prisma-csb/rest-example-ts?initialpath=/feed">REST API</a> example in CodeSandbox instead.
</p> -->

## Getting started

The easiest way to get started with Photon is by installing the Prisma 2 CLI and running the interactive `init` command:

```sh
npm install -g prisma2
prisma2 init hello-prisma
```

The interactive prompt will ask you to provide database credentials for your database. If you don't have a database yet, select **SQLite** and let the CLI set up a database file for you.

Learn more about the `prisma2 init` flow [here](https://github.com/prisma/prisma2/blob/master/docs/getting-started.md).

## Features

- Auto-generated database client
- Fully **type-safe** data access API (even for JavaScript), including:
  - Field selection, lazy/eager loading
  - Fluent API to traverse relations
  - Transactional nested writes and batching API
  - Relation filters (filter on JOINed tables)
  - Powerful methods for filtering, sorting and (cursor) pagination
- [Data mapper](https://en.wikipedia.org/wiki/Data_mapper_pattern) ORM pattern
- Declarative data modelling and migrations with [Lift](https://github.com/prisma/lift)
- Connection pooling
- Works with existing databases using schema introspection
- CLI to support all major workflows
- Integrates seamlessly in your npm projects (without `npm install`)

## Docs

You can find comprehensive documentation for Photon in the [Prisma 2 docs](https://github.com/prisma/prisma2).

## API examples

Here are few example API calls:

```ts
import Photon from '@generated/photon'

const photon = new Photon()

async function main() {
  await photon.connect()

  const userById = await photon.users.findOne({ where: { id: 1 } })
  const userByEmail = await photon.users.findOne({ where: { email: "ada@prisma.io" }})

  const userWithPosts = await photon.users.findOne({
    where: { email: "ada@prisma.io" },
    include: { posts: { first: 10 } },
  })

  const newUser = await photon.users.create({ data: {
    name: "Alice",
    email: "alice@prisma.io",
  }})

  const newUserWithPosts = await photon.users.create({ data: {
    email: "alice@prisma.io",
    posts: {
      create: [
        { title: "Join us for Prisma Day. June 19, Berlin!" },
        { title: "Follow Prisma on Twitter!" },
      ]
    }
  }})

  const updatedUser = await photon.users.update({
    where: { email: "alice@prisma.io" },
    data: { role: "ADMIN" },
  })
}

main().catch(e => {
  console.error(e)
}).finally(async () => {
  await photon.disconnect()
})
```

<Details><Summary>Expand to the view the <strong>data model</strong> based on which the above Photon API was generated</Summary>

```groovy
datasource ds {
  // some data source config, e.g. SQLite, PostgreSQL, ...
}

generator photonjs {
  provider = "photonjs"
}

model User {
  id         Int       @id
  email      String    @unique
  name       String
  posts      Post[]
}

model Post {
  id          Int       @id
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  draft       Boolean   @default(true)
  author      User
}
```

Learn more about the data model in the [docs](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md).

</Details>

You can learn more about the Photon's API features on the [website](https://photonjs.prisma.io/) or in the [API reference](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md).

## The Photon JS workflow

### 1. Configure data source

<img src="https://i.imgur.com/UcN3ENI.png" width="220px">

Specify the connection details for your database as a _data source_ in your [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). The connection details might differ per database, but most commonly you'll provide the following:

- Host: The IP address or domain name of the machine where your database server is running.
- Port: The port on which your database server is listening.
- User & password: Credentials for your database server.

Here is an example schema file that connects to a local PostgreSQL database:

```groovy
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator photonjs {
  provider = "photonjs"
}
```

### 2. Define initial data model

The [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) is a declarative and human-readable representation of your database schema. Here is the schema file from above extended with a sample data model:

```groovy
// schema.prisma

datasource postgres {
  url      = "postgresql://user:password@localhost:5432"
  provider = "postgres"
}

generator photonjs {
  provider = "photonjs"
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

Read below to learn how you obtain it for your project.

#### Option A: Starting with an existing database (_brownfield_)

<img src="https://i.imgur.com/XkRkwdE.png" width="355px">

If you want to use Photon with an existing database, you can [introspect](https://github.com/prisma/prisma2/blob/master/docs/introspection.md) your database schema using the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md). This generates a [data model](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) which is the foundation for the generated Photon API.

#### Option B: Start from scratch (_greenfield_)

When starting from scratch, you can simply write your own [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) inside your [schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). You can then use [Lift](https://github.com/prisma/lift) to migrate your database (Lift maps your data model definition to the schema of the underlying database).

### 3. Generate Photon JS

<img src="https://i.imgur.com/rdtKEYL.png" width="453px">

Generate your Photon database client using the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md):

```sh
prisma2 generate
```

Photon is generated based on the [data model definition](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md#data-model-definition) and provides a type-safe API with the following features:

- CRUD
- Filter, sorting and (cursor) pagination
- Field selection and eager loading
- Relations and transactions
- Raw database access

Photon JS gets generated into your `node_modules` folder so you can import it directly from `'@generated/photon'`. There's no need to install any additional dependencies or database drivers.

### 4. Build an app

Similar to traditional ORMs, the Photon JS client can be used any of your Node.js or TypeScript application. For example to implement REST, GraphQL or gRPC APIs. You can find reference examples for these use cases in the [`examples`](./examples) directory.

### 5. Evolve your database and Photon JS database client

As you build your app, you'll likely migrate your database to implement new features. Depending on how you obtained your [initial data model](#2-define-initial-data-model) and whether or not you're using [Lift](https://github.com/prisma/lift), there might be two ways for evolving your application going forward.

#### Option A: Without Lift

If you're not using Lift, you need to re-introspect your database (to update the generated datamodel) and re-generate the Photon JS client after each schema migration:

```sh
prisma2 introspect
prisma2 generate
```

#### Option B: With Lift

When using Lift, you need to re-generate the Photon JS client immediately after you performed a schema migration:

```sh
# adjust data model definition in schema.prisma
prisma2 lift save
prisma2 lift up
prisma2 generate
```

## Supported databases

Photon JS can be used with the following databases:

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
