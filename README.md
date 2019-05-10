<p align="center"><a href="https://www.prisma.io"><img src="https://svgur.com/i/CXu.svg" alt="Prisma" height="66px"></a></p>

<p><h1 align="center">Photon JS</h1></p>
<p><h3 align="center">Type-safe ORM for TypeScript & Node.js</h3></p>

<p align="center">
  <a href="#overview">Overview</a> • <a href="#quickstart">Quickstart</a> • <a href="#examples">Examples</a> • <a href="#supported-databases">Supported databases</a> 
</p>


<p align="center">
  <a href="https://circleci.com/gh/prisma/prisma"><img src="https://circleci.com/gh/prisma/prisma.svg?style=shield" alt="CircleCI"></a>
  <a href="https://slack.prisma.io"><img src="https://slack.prisma.io/badge.svg" alt="Slack"></a>
  <a href="https://spectrum.chat/prisma"><img src="https://withspectrum.github.io/badge/badge.svg" alt="Spectrum"></a>
</p>


Photon JS is an **auto-generated database client** that enables **type-safe** database access and **reduces boilerplate**. You can use it as an alternative to traditional ORMs such as Sequelize, TypeORM or Knex.js.

It is part of the [Prisma]() ecosystem. Prisma provides a family of tools to simplify database workflows for data access, declarative data modeling, schema migrations and visual data management. [Learn more.]()

<br />

<p align="center">
  <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a>
  <a href="https://www.prisma.io/docs/prisma-client/"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

<p align="center">
  Or try an online <a href="https://codesandbox.io/s/github/prisma-csb/graphql-example-ts">GraphQL API</a> or <a href="https://codesandbox.io/s/github/prisma-csb/rest-example-ts?initialpath=/feed">REST API</a> example in CodeSandbox instead.
</p>


## Overview

### Features

- Auto-generated database client
- Fully type-safe data access API (even for JavaScript)
- Powerful methods for filtering, sorting and (cursor) pagination
- [Data mapper](https://en.wikipedia.org/wiki/Data_mapper_pattern) ORM pattern
- Transactional nested writes for simple transactions
- Declarative data modelling and migrations
- Connection pooling
- Supports legacy databases and schema introspection
- CLI to support all major workflows

### Upcoming

- Using the Prisma client as a simple library (it currently requires running an extra database proxy server)
- More powerful data access API ([learn more](https://github.com/prisma/rfcs/blob/new-ts-client-rfc/text/0000-new-ts-client.md))

## Quickstart

#### 1. Install Prisma CLI

```
npm install -g prisma
```

#### 2. Setup database

To setup Prisma, you need to have [Docker](https://www.docker.com) installed. Run the following command to get started:

```
prisma init hello-world
```

The interactive CLI wizard now helps you with the required setup:

- Select **Create new database** (you can also use an [existing database](https://www.prisma.io/docs/-t003/) or a hosted [demo database](https://www.prisma.io/docs/-t001/))
- Select the database type: **MySQL**, **PostgreSQL** or **MongoDB**
- Select the language for the generated Prisma client: **TypeScript** or **JavaScript**

Once the wizard has terminated, run the following commands to launch the database and its proxy server:

```
cd hello-world
docker-compose up -d
```

#### 3. Define datamodel

Edit `datamodel.prisma` to define your datamodel using [SDL](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51/) syntax. Each model is mapped to a _table_ (or MongoDB _collection_) in your database schema:

```graphql
type User {
  id: ID! @id
  email: String @unique
  name: String!
  posts: [Post!]!
}

type Post {
  id: ID! @id
  title: String!
  published: Boolean! @default(value: false)
  author: User
}
```

#### 4. Deploy datamodel & migrate database

Run the following command to deploy your datamodel and migrate your database schema:

```
prisma deploy 
```

> Learn more about the upcoming changes for a more [powerful migration system](https://github.com/prisma/rfcs).

#### 5. Use the Prisma client (Node.js)

The Prisma client connects to the Prisma API and lets you perform read and write operations against your database. This section explains how to use the Prisma client from **Node.js**.

Inside the `hello-world` directory, install the `prisma-client-lib` dependency:

```
npm install --save prisma-client-lib
```

To generate the Prisma client, run the following command:

```
prisma generate
```

Create a new Node.js script inside the `hello-world` directory:

```
touch index.js
```

Now add the following code to it:

```js
const { prisma } = require('./generated/prisma-client')

// A `main` function so that we can use async/await
async function main() {
  // Create a new user with a new post
  const newUser = await prisma.createUser({
    name: 'Alice',
    posts: {
      create: { title: 'Join us for Prisma Day 2019' }
    }
  })
  console.log(`Created new user: ${newUser.name} (ID: ${newUser.id})`)

  // Read all users from the database and print them to the console
  const allUsers = await prisma.users()
  console.log(allUsers)

  // Read all posts from the database and print them to the console
  const allPosts = await prisma.posts()
  console.log(allPosts)
}

main().catch(e => console.error(e))
```

Finally, run the code using the following command:

```
node index.js
```

<details><summary><b>See more API operations</b></summary>
<p>

```js
const usersCalledAlice = await prisma
  .users({ where: { name: "Alice" }})
```

```js
// replace the __USER_ID__ placeholder with an actual user ID
const updatedUser = await prisma
  .updateUser({
    where: { id: "__USER_ID__" },
    data: { email: "alice@prisma.io" }
  })
```

```js
// replace the __USER_ID__ placeholder with an actual user ID
const deletedUser = await prisma
  .deleteUser({ id: "__USER_ID__" })
```

```js
const postsByAuthor = await prisma
  .user({ email: "alice@prisma.io" })
  .posts()
```

</p>
</details>


#### 6. Next steps

Here is what you can do next:

- [Build an app with Prisma client](https://www.prisma.io/docs/-t201/)
- [Check out some examples](#examples)
- [Read more about how Prisma works](https://www.prisma.io/docs/-j9ff/)

## Examples

#### TypeScript

| Demo | Description |
|:------|:----------|
| [`script`](https://github.com/prisma/prisma-examples/tree/master/typescript/script) | Simple usage of Prisma client in script |
| [`graphql`](https://github.com/prisma/prisma-examples/tree/master/typescript/graphql) | Simple GraphQL server based on [`graphql-yoga`](https://github.com/prisma/graphql-yoga) |
| [`graphql-apollo-server`](https://github.com/prisma/prisma-examples/tree/master/typescript/graphql-apollo-server) | Simple GraphQL server based on [`apollo-server`](https://www.apollographql.com/docs/apollo-server/) |
| [`graphql-crud`](https://github.com/prisma/prisma-examples/tree/master/typescript/graphql-crud) | GraphQL server with full CRUD API |
| [`graphql-auth`](https://github.com/prisma/prisma-examples/tree/master/typescript/graphql-auth) | GraphQL server with email-password authentication & permissions |
| [`graphql-subscriptions`](https://github.com/prisma/prisma-examples/tree/master/typescript/graphql-subscriptions) | GraphQL server with realtime subscriptions |
| [`rest-express`](https://github.com/prisma/prisma-examples/tree/master/typescript/rest-express) | Simple REST API with Express.JS |
| [`grpc`](https://github.com/prisma/prisma-examples/tree/master/typescript/grpc) | Simple gRPC API |
| [`docker-mongodb`](https://github.com/prisma/prisma-examples/tree/master/typescript/docker-mongodb) | Set up Prisma locally with MongoDB |
| [`docker-mysql`](https://github.com/prisma/prisma-examples/tree/master/typescript/docker-mysql) | Set up Prisma locally with MySQL |
| [`docker-postgres`](https://github.com/prisma/prisma-examples/tree/master/typescript/docker-postgres) | Set up Prisma locally with PostgreSQL |
| [`cli-app`](https://github.com/prisma/prisma-examples/tree/master/typescript/cli-app) | Simple CLI TODO list app |

#### Node.js

| Demo | Description |
|:------|:----------|
| [`script`](https://github.com/prisma/prisma-examples/tree/master/node/script) | Simple usage of Prisma client in script |
| [`graphql`](https://github.com/prisma/prisma-examples/tree/master/node/graphql) | Simple GraphQL server |
| [`graphql-auth`](https://github.com/prisma/prisma-examples/tree/master/node/graphql-auth) | GraphQL server with email-password authentication & permissions |
| [`graphql-subscriptions`](https://github.com/prisma/prisma-examples/tree/master/node/graphql-subscriptions) | GraphQL server with realtime subscriptions |
| [`rest-express`](https://github.com/prisma/prisma-examples/tree/master/node/rest-express) | Simple REST API with Express.JS |
| [`grpc`](https://github.com/prisma/prisma-examples/tree/master/node/grpc) | Simple gRPC API |
| [`docker-mongodb`](https://github.com/prisma/prisma-examples/tree/master/node/docker-mongodb) | Set up Prisma locally with MongoDB |
| [`docker-mysql`](https://github.com/prisma/prisma-examples/tree/master/node/docker-mysql) | Set up Prisma locally with MySQL |
| [`docker-postgres`](https://github.com/prisma/prisma-examples/tree/master/node/docker-postgres) | Set up Prisma locally with PostgreSQL |
| [`cli-app`](https://github.com/prisma/prisma-examples/tree/master/node/cli-app) | Simple CLI TODO list app |

## Supported databases

- PostgreSQL
- MySQL
- MongoDB

Further **upcoming** databases are:

- [Elastic Search](https://github.com/prisma/prisma/issues/1665)
- [MS SQL](https://github.com/prisma/prisma/issues/1642)
- [Oracle](https://github.com/prisma/prisma/issues/1644)
- [ArangoDB](https://github.com/prisma/prisma/issues/1645)
- [Neo4j](https://github.com/prisma/prisma/issues/1646)
- [Druid](https://github.com/prisma/prisma/issues/1647)
- [Dgraph](https://github.com/prisma/prisma/issues/1648)
- [DynamoDB](https://github.com/prisma/prisma/issues/1655)
- [Cloud Firestore](https://github.com/prisma/prisma/issues/1660)
- [CockroachDB](https://github.com/prisma/prisma/issues/1705)
- [Cassandra](https://github.com/prisma/prisma/issues/1750)
- [Redis](https://github.com/prisma/prisma/issues/1722)
- [AWS Neptune](https://github.com/prisma/prisma/issues/1752)
- [CosmosDB](https://github.com/prisma/prisma/issues/1663)
- [Influx](https://github.com/prisma/prisma/issues/1857)

## Community


Prisma has a [community](https://www.prisma.io/community) of thousands of amazing developers and contributors. Welcome, please join us! 👋

> Meet the Prisma community in person and learn about modern application development and database best practices at [**Prisma Day**](https://www.prisma.io/day/) (Berlin, June 19).

