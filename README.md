<p align="center"><a href="https://www.prisma.io"><img src="https://svgur.com/i/CXu.svg" alt="Prisma" height="66px"></a></p>

<p><h1 align="center">Photon JS</h1></p>
<p><h3 align="center">Type-safe database client (ORM) for TypeScript & Node.js</h3></p>

<p align="center">
  <a href="https://www.github.com/prisma/prisma2-docs">Docs</a> • <a href="#features">Features</a> • <a href="#how-it-works">How it works</a> • <a href="#supported-databases">Supported databases</a> 
</p>

<!--
<p align="center">
  <a href="https://circleci.com/gh/prisma/prisma"><img src="https://circleci.com/gh/prisma/prisma.svg?style=shield" alt="CircleCI"></a>
  <a href="https://slack.prisma.io"><img src="https://slack.prisma.io/badge.svg" alt="Slack"></a>
  <a href="https://spectrum.chat/prisma"><img src="https://withspectrum.github.io/badge/badge.svg" alt="Spectrum"></a>
</p>
-->

Photon JS is an **auto-generated database client library** that enables **type-safe** database access and **reduces boilerplate**. You can use it as an alternative to traditional ORMs such as Sequelize, TypeORM or Knex.js

It is part of the [Prisma](https://www.github.com/prisma/prisma2-docs) ecosystem. Prisma provides a family of tools to simplify database workflows for data access, declarative data modeling, schema migrations and visual data management. Learn more in the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/).

<br />

<p align="center">
  <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a>
  <a href="https://www.prisma.io/docs/prisma-client/"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

<p align="center">
  Or try an online <a href="https://codesandbox.io/s/github/prisma-csb/graphql-example-ts">GraphQL API</a> or <a href="https://codesandbox.io/s/github/prisma-csb/rest-example-ts?initialpath=/feed">REST API</a> example in CodeSandbox instead.
</p>


## Features

- Auto-generated database client
- Fully type-safe data access API (even for JavaScript)
- Powerful methods for filtering, sorting and (cursor) pagination
- [Data mapper](https://en.wikipedia.org/wiki/Data_mapper_pattern) ORM pattern
- Transactional nested writes and batching API
- Declarative data modelling and migrations
- Connection pooling
- Works with existing databases using schema introspection
- CLI to support all major workflows
- Integrates seamlessly in your npm projects (without `npm install`)

## Example

```ts
// Fetch user by id or email
const userById = await prisma.users.findOne({ where: "cjnymovv3s3ht0a516fhmria8" })
const userByEmail = await prisma.users.findOne({ where: { email: "ada@prisma.io" }})

// Fetch a user with their first 10 posts
const userWithPosts = await prisma.users.findOne({
  where: { email: "ada@prisma.io" },
  include: { posts: { first: 10 } },
})

// Create a new user
const newUser = await prisma.users.create({ data: {
  name: "Alice",
  email: "alice@prisma.io",
}})

// Create a new user with two posts in a single transaction
const newUser = await prisma.users.create({ data: {
  email: "alice@prisma.io",
  posts: {
    create: [
      { title: "Join us for Prisma Day. June 19, Berlin!" },
      { title: "Follow Prisma on Twitter!" },
    ]
  }
}})

// Update an existing user
const updatedUser = await prisma.users.update({
  where: { email: "alice@prisma.io" },
  data: { role: "ADMIN" },
})
```

[**See more exmaples**](#)

## How it works

### 1. Configure database access

<img src="https://i.imgur.com/UcN3ENI.png" width="220px">

Specify the connection details for your database:

- `host`: The IP address or domain name of the machine where your database server is running.
- `port`: The port on which your database server is listening.
- `user` & `password`: Credentials for your database sever.


### 2. Introspect your database

<img src="https://i.imgur.com/XkRkwdE.png" width="355px">

Introspect your database schema using the Prisma CLI. This generates a [datamodel]() which is the foundation for the generated Photon database client. The datamodel is a declarative and human-readable representation of your database schema.

### 3. Generate Photon JS

<img src="https://i.imgur.com/rdtKEYL.png" width="453px">

Generate your Photon database client using the Prisma CLI. Photon is generated based on the datamodel and provides an API with the following features:

- CRUD
- Filter, sorting and (cursor) pagination
- Relations and transactions
- Raw database access

Photon JS gets generated into your `node_modules` folder. There's no need to install any additional dependencies or database drivers.

### 4. Build an app

Similar to traditional ORMs, the Photon JS client can be used any of your Node.js or TypeScript applications. For example to implement REST, GraphQL or gRPC APIs.

### 5. Evolve your database and Photon JS database client

As you build your app, you'll likely migrate your database to implement new features. After each schema migration, you need to re-introspect the database (to update the generated datamodel) and re-generate the Photon JS client to account for the new schema.

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
