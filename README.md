![Prisma](https://i.imgur.com/h6UIYTu.png)

<div align="center">
  <h1>Prisma</h1>
  <a href="https://www.npmjs.com/package/prisma"><img src="https://img.shields.io/npm/v/prisma.svg?style=flat" /></a>
  <a href="https://github.com/prisma/prisma/blob/main/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" /></a>
  <a href="https://github.com/prisma/prisma/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-blue" /></a>
  <a href="https://slack.prisma.io/"><img src="https://img.shields.io/badge/chat-on%20slack-blue.svg" /></a>
  <br />
  <br />
  <a href="https://www.prisma.io/docs/getting-started/quickstart">Quickstart</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.prisma.io/">Website</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.prisma.io/docs/">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/prisma/prisma-examples/">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.prisma.io/blog">Blog</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://slack.prisma.io/">Slack</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://twitter.com/prisma">Twitter</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/prisma/prisma1">Prisma 1</a>
  <br />
  <hr />
</div>

## What is Prisma?

Prisma is a **next-generation ORM** that consists of these tools:

- [**Prisma Client**](https://www.prisma.io/docs/concepts/components/prisma-client): Auto-generated and type-safe query builder for Node.js & TypeScript
- [**Prisma Migrate**](https://www.prisma.io/docs/concepts/components/prisma-migrate): Declarative data modeling & migration system
- [**Prisma Studio**](https://github.com/prisma/studio): GUI to view and edit data in your database

Prisma Client can be used in _any_ Node.js or TypeScript backend application (including serverless applications and microservices). This can be a [REST API](https://www.prisma.io/docs/understand-prisma/prisma-in-your-stack/rest), a [GraphQL API](https://www.prisma.io/docs/understand-prisma/prisma-in-your-stack/graphql), a gRPC API, or anything else that needs a database.

> **Are you looking for Prisma 1? The Prisma 1 repository has been renamed to [`prisma/prisma1`](https://github.com/prisma/prisma1)**.

## Getting started

The fastest way to get started with Prisma is by following the [**Quickstart (5 min)**](https://www.prisma.io/docs/getting-started/quickstart-typescript).

The Quickstart is based on a preconfigured SQLite database. You can also get started with your own database (PostgreSQL and MySQL) by following one of these guides:

- [Add Prisma to an existing project](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project-typescript-postgres)
- [Set up a new project with Prisma from scratch](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch-typescript-postgres)

## How does Prisma work

This section provides a high-level overview of how Prisma works and its most important technical components. For a more thorough introduction, visit the [Prisma documentation](https://www.prisma.io/docs/).

### The Prisma schema

Every project that uses a tool from the Prisma toolkit starts with a [Prisma schema file](https://www.prisma.io/docs/concepts/components/prisma-schema). The Prisma schema allows developers to define their _application models_ in an intuitive data modeling language. It also contains the connection to a database and defines a _generator_:

```prisma
// Data source
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Generator
generator client {
  provider = "prisma-client-js"
}

// Data model
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User?   @relation(fields:  [authorId], references: [id])
  authorId  Int?
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}
```

In this schema, you configure three things:

- **Data source**: Specifies your database connection (via an environment variable)
- **Generator**: Indicates that you want to generate Prisma Client
- **Data model**: Defines your application models

---

### The Prisma data model

On this page, the focus is on the data model. You can learn more about [Data sources](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-sources) and [Generators](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/generators) on the respective docs pages.

#### Functions of Prisma models

The data model is a collection of [models](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-models). A model has two major functions:

- Represent a table in the underlying database
- Provide the foundation for the queries in the Prisma Client API

#### Getting a data model

There are two major workflows for "getting" a data model into your Prisma schema:

- Generate the data model from [introspecting](https://www.prisma.io/docs/concepts/components/introspection) a database
- Manually writing the data model and mapping it to the database with [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)

Once the data model is defined, you can [generate Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client/generating-prisma-client) which will expose CRUD and more queries for the defined models. If you're using TypeScript, you'll get full type-safety for all queries (even when only retrieving the subsets of a model's fields).

---

### Accessing your database with Prisma Client

#### Generating Prisma Client

The first step when using Prisma Client is installing its npm package:

```
npm install @prisma/client
```

Note that the installation of this package invokes the `prisma generate` command which reads your Prisma schema and _generates_ the Prisma Client code. The code will be located in `node_modules/.prisma/client`, which is exported by `node_modules/@prisma/client/index.d.ts`.

After you change your data model, you'll need to manually re-generate Prisma Client to ensure the code inside `node_modules/.prisma/client` get updated:

```
npx prisma generate
```

Refer to the documentation for more information about ["generating the Prisma client"](https://www.prisma.io/docs/concepts/components/prisma-client/generating-prisma-client).

#### Using Prisma Client to send queries to your database

Once the Prisma Client is generated, you can import it in your code and send queries to your database. This is what the setup code looks like.

##### Import and instantiate Prisma Client

You can import and instantiate Prisma Client as follows:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
```

or

```js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
```

Now you can start sending queries via the generated Prisma Client API, here are few sample queries. Note that all Prisma Client queries return _plain old JavaScript objects_.

Learn more about the available operations in the [Prisma Client docs](https://www.prisma.io/docs/concepts/components/prisma-client) or watch this [demo video](https://www.youtube.com/watch?v=LggrE5kJ75I&list=PLn2e1F9Rfr6k9PnR_figWOcSHgc_erDr5&index=4) (2 min).

##### Retrieve all `User` records from the database

```ts
// Run inside `async` function
const allUsers = await prisma.user.findMany()
```

##### Include the `posts` relation on each returned `User` object

```ts
// Run inside `async` function
const allUsers = await prisma.user.findMany({
  include: { posts: true },
})
```

##### Filter all `Post` records that contain `"prisma"`

```ts
// Run inside `async` function
const filteredPosts = await prisma.post.findMany({
  where: {
    OR: [{ title: { contains: 'prisma' } }, { content: { contains: 'prisma' } }],
  },
})
```

##### Create a new `User` and a new `Post` record in the same query

```ts
// Run inside `async` function
const user = await prisma.user.create({
  data: {
    name: 'Alice',
    email: 'alice@prisma.io',
    posts: {
      create: { title: 'Join us for Prisma Day 2021' },
    },
  },
})
```

##### Update an existing `Post` record

```ts
// Run inside `async` function
const post = await prisma.post.update({
  where: { id: 42 },
  data: { published: true },
})
```

#### Usage with TypeScript

Note that when using TypeScript, the result of this query will be _statically typed_ so that you can't accidentally access a property that doesn't exist (and any typos are caught at compile-time). Learn more about leveraging Prisma Client's generated types on the [Advanced usage of generated types](https://www.prisma.io/docs/concepts/components/prisma-client/advanced-usage-of-generated-types) page in the docs.

## Community

Prisma has a large and supportive [community](https://www.prisma.io/community) of enthusiastic application developers. You can join us on [Slack](https://slack.prisma.io) and here on [GitHub](https://github.com/prisma/prisma/discussions).

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20).

## Support

### Ask a question about Prisma

You can ask questions and initiate [discussions](https://github.com/prisma/prisma/discussions/) about Prisma-related topics in the `prisma` repository on GitHub.

👉 [**Ask a question**](https://github.com/prisma/prisma/discussions/new)

### Create a bug report for Prisma

If you see an error message or run into an issue, please make sure to create a bug report! You can find [best practices for creating bug reports](https://www.prisma.io/docs/support/creating-bug-reports) (like including additional debugging output) in the docs.

👉 [**Create bug report**](https://github.com/prisma/prisma/issues/new?assignees=&labels=&template=bug_report.md&title=)

### Submit a feature request

If Prisma currently doesn't have a certain feature, be sure to check out the [roadmap](https://www.prisma.io/docs/more/roadmap) to see if this is already planned for the future.

If the feature on the roadmap is linked to a GitHub issue, please make sure to leave a +1 on the issue and ideally a comment with your thoughts about the feature!

👉 [**Submit feature request**](https://github.com/prisma/prisma/issues/new?assignees=&labels=&template=feature_request.md&title=)

## Contributing

Refer to our [contribution guidelines](https://github.com/prisma/prisma/blob/main/CONTRIBUTING.md) and [Code of Conduct for contributors](https://github.com/prisma/prisma/blob/main/CODE_OF_CONDUCT.md).

## Build Status

- Prisma Tests Status:  
  [![Build status](https://badge.buildkite.com/590e1981074b70961362481ad8319a831b44a38c5d468d6408.svg?branch=main)](https://buildkite.com/prisma/prisma2-test)
- Ecosystem Tests Status:  
  [![Actions Status](https://github.com/prisma/ecosystem-tests/workflows/test/badge.svg)](https://github.com/prisma/ecosystem-tests/actions)
