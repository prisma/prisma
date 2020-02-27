# Upgrade guide (Prisma 1 to Prisma 2)

This upgrade guide describes how to migrate a Node.js project that's based on [Prisma 1](https://github.com/prisma/prisma) and uses the [Prisma client](https://www.prisma.io/docs/prisma-client/) to Prisma 2.

## Overview

On a high-level, the biggest differences between Prisma 1 and Prisma 2 are the following:

- Prisma 2 doesn't require hosting a database proxy server (i.e. the [Prisma server](https://www.prisma.io/docs/prisma-server/)).
- Prisma 2 makes the features of Prisma 1 more modular:
  - _Data modeling and migrations_ from Prisma 1 are now done via a dedicated `prisma2 migrate` subcommand
  - _Database access using the Prisma client_ from Prisma 1 is done using Prisma Client JS
- The Prisma 1 datamodel and the `prisma.yml` have been merged into the [Prisma schema](../prisma-schema-file.md) that's used in Prisma 2
- Prisma 2 uses a its own modeling language instead of being based on GraphQL SDL

Based on these differences, the high-level steps to upgrade a project from using Prisma 1 are as follows:

1. Install Prisma 2 CLI as a development dependency
1. Use Prisma 2 CLI to convert your Prisma 1 datamodel to the Prisma schema
1. Adjust your application code, specifically replace the API calls from the Prisma client with those of Prisma Client JS

Note that the steps will look somewhat different if you're ...: 

- **not using the Prisma client** (e.g. because you're using Prisma bindings).
- **building a GraphQL API using `nexus-prisma`**.

Both scenarios will be covered in other upgrade guides. In this guide, we'll take a look at migrating a REST API from Prisma 1 to Prisma 2 based on this [Prisma 1 example](https://github.com/prisma/prisma-examples/tree/master/typescript/rest-express).

> **Note**: If you're upgrading a project that uses `nexus-prisma`, be sure to check out [@AhmedElywa](https://github.com/AhmedElywa)'s project [`create-nexus-type`](https://github.com/oahtech/create-nexus-type) that converts Prisma models into Nexus `objectType` definitions.

## 1. Install Prisma 2 CLI 

Prisma 2 CLI is currently available as the [`prisma2`](https://www.npmjs.com/package/prisma2) package on npm. You can install it in your Node.js project as follows (be sure to invoke this command in the directory where your `package.json` is located):

```
npm install prisma2 --save-dev
```

You can now use the local installation of the `prisma2` CLI using `npx`:

```
npx prisma2
```

## 2. Convert the Prisma 1 datamodel to a Prisma schema

The [Prisma schema](./prisma-schema-file.md) is the foundation for any project that uses Prisma 2. Think of the Prisma schema as the combination of the Prisma 1 data model and `prisma.yml` configuration file.

There are three ways of obtaining a Prisma schema based on an existing Prisma 1 project:

- Writing the Prisma schema by hand
- Using introspection against the existing database
- Using the `prisma2 convert` command

Note that [introspection is not yet available](https://github.com/prisma/prisma2/issues/781), so for the purpose of this upgrade guide you'll use the `prisma2 convert` command which converts a Prisma 1 data model to a Prisma schema file. Note that the resulting Prisma schema will not contain any data source and generator definitions yet, these must be added manually.

### 2.1. Convert the datamodel

Assuming your Prisma 1 datamodel is called `datamodel.prisma`, you can use the following command to create a Prisma schema file called `schema.prisma`:

```bash
cat datamodel.prisma | npx prisma2@2.0.0-preview017 convert > schema.prisma
```

> **Note**: The `convert` command has been removed from Prisma 2 CLI in [2.0.0-preview018](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview018) so you're using it based on an older CLI version.

Consider the [example datamodel](https://github.com/prisma/prisma-examples/blob/master/typescript/rest-express/prisma/datamodel.prisma):

```graphql
type User {
  id: ID! @id
  email: String! @unique
  name: String
  posts: [Post!]!
}

type Post {
  id: ID! @id
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
  published: Boolean! @default(value: false)
  title: String!
  content: String
  author: User!
}
```

This Prisma 1 datamodel will be converted into the following Prisma schema:

```prisma
model User {
  id    String  @default(cuid()) @id @unique
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User
}
```

> **Note**: The `@unique` attributes on the `id` fields are [redundant](https://github.com/prisma/prisma2/issues/786) as uniqueness is already implied by the `@id` attribute. It also contains another bug where it [doesn't convert `@default` attributes](https://github.com/prisma/prisma2/issues/790), so you need to manually add the `@default(true)` to the `published` field in the Prisma schema.

### 2.2. Add the datasource

In Prisma 1, the database connection is specified on the Docker image that's used to deploy the Prisma server. The Prisma server then exposes an HTTP endpoint that proxies all database requests from actual application code. That HTTP endpoint is specified in your `prisma.yml`.

With Prisma 2, the HTTP layer isn't exposed any more and the database client (Prisma Client JS) is configured to run requests "directly" against the database (that is, requests are proxied by its query engine, but there isn't an extra server any more).

So, as a next step you'll need to tell Prisma 2 where your database is located. You can do so by adding a `datasource` block to your Prisma schema, here is what it looks like (using placeholder values):

```prisma
datasource db {
  provider = "DB_PROVIDER"
  url      = "DB_CONNECTION_STRING"
}
```

You'll now need to replace the placeholder `DB_PROVIDER` and `DB_CONNECTION_STRING` with the actual connection details of your database.

For the `provider` field, you need to add either of three values:

- `mysql` for a MySQL database
- `postgresql` for a PostgreSQL database
- `sqlite` for a SQLite database

The `url` field then defines the _connection string_ of the database. Assume the database configuration in your Docker Compose file that you used to deploy your Prisma server looks as follows:

```yml
databases:
  default:
    connector: postgres
    host: host.docker.internal
    database: mydb
    schema: public
    user: janedoe
    password: janedoe
    ssl: false
    rawAccess: true
    port: '5432'
    migrations: true
```

Based on these connection details, you need to add the following `datasource` to the `schema.prisma` file that was created when you invoked `prisma2 convert`:

```diff
+ datasource postgresql {
+   provider = "postgresql"
+   url =      "postgresql://janedoe:janedoe@localhost:5432/mydb?schema=public"
+ }

model User {
  id    String  @default(cuid()) @id
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean  @default(true)
  title     String
  content   String?
  author    User
}
```

### 2.3. Add the generator

With Prisma 1, you specified which language variant of the Prisma client you wanted to use based in your `prisma.yml`, e.g.:

```yml
generate:
  - generator: typescript-client
    output: ../src/generated/prisma-client/
```

With Prisma 2, this information is now also contained inside the Prisma schema via a `generator` block. Add it to your your Prisma schema like so:

```diff
datasource postgresql {
  provider = "postgresql"
  url =      "postgresql://janedoe:janedoe@localhost:5432/mydb?schema=public"
}

+ generator client {
+   provider = "prisma-client-js"
+ }

model User {
  id    String  @default(cuid()) @id
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean  @default(true)
  title     String
  content   String?
  author    User
}
```

Note that the code for Prisma Client JS [by default gets generated into `node_modules/@prisma/client`](https://github.com/prisma/prisma2/blob/master/docs/prisma-client-js/codegen-and-node-setup.md) but can be customized via an `output` field on the `generator` block. You also need to install `@prisma/client` as another npm dependency in your project.

## 3. Adjust the application to use Prisma Client JS

Prisma Client JS is generated into `node_modules/@prisma/client`. In order for this package to "survive" the pruning of Node.js package managers, you first need to install it as an npm dependency:

```
npm install @prisma/client
```

The next thing you need to do in order to be able use Prisma Client JS in your application code is to generate it. Similar to Prisma 1, the generators in your Prisma schema file can be invoked by running the `generate` CLI command:

```
npx prisma2 generate
```

To make the migration complete, you have to change your application code and replace the usage of the Prisma client with the new Prisma Client JS.

The application code in our example is located in a single file and looks as follows:

```ts
import * as express from 'express'
import * as bodyParser from 'body-parser'
import { prisma } from './generated/prisma-client'

const app = express()

app.use(bodyParser.json())

app.post(`/user`, async (req, res) => {
  const result = await prisma.createUser({
    ...req.body,
  })
  res.json(result)
})

app.post(`/post`, async (req, res) => {
  const { title, content, authorEmail } = req.body
  const result = await prisma.createPost({
    title: title,
    content: content,
    author: { connect: { email: authorEmail } },
  })
  res.json(result)
})

app.put('/publish/:id', async (req, res) => {
  const { id } = req.params
  const post = await prisma.updatePost({
    where: { id },
    data: { published: true },
  })
  res.json(post)
})

app.delete(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.deletePost({ id })
  res.json(post)
})

app.get(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post({ id })
  res.json(post)
})

app.get('/feed', async (req, res) => {
  const posts = await prisma.post({ where: { published: true } })
  res.json(posts)
})

app.get('/filterPosts', async (req, res) => {
  const { searchString } = req.query
  const draftPosts = await prisma.post({
    where: {
      OR: [
        {
          title_contains: searchString,
        },
        {
          content_contains: searchString,
        },
      ],
    },
  })
  res.json(draftPosts)
})

app.listen(3000, () =>
  console.log('Server is running on http://localhost:3000'),
)
```

Consider each occurence of the Prisma client instance `prisma` and replacing with the respective usage of Prisma Client JS.

### 3.1. Adjusting the import

Since Prisma Client JS is generated into `node_modules/@prisma/client`, it is imported as follows:

```ts
import { PrismaClient } from '@prisma/client'
```

Note that this only imports the `PrismaClient` constructor, so you also need to instantiate a Prisma Client JS instance:

```ts
const prisma = new PrismaClient()
```

### 3.2. Adjusting the `/user` route (`POST`)

With the Prisma Client JS API, the `/user` route for `POST` requests has to be changed to:

```ts
app.post(`/user`, async (req, res) => {
  const result = await prisma.user.create({
    data: {
      ...req.body,
    },
  })
  res.json(result)
})
```

### 3.3. Adjusting the `/post` route (`POST`)

With the Prisma Client JS API, the `/post` route for `POST` requests has to be changed to:

```ts
app.post(`/post`, async (req, res) => {
  const { title, content, authorEmail } = req.body
  const result = await prisma.post.create({
    data: {
      title: title,
      content: content,
      author: { connect: { email: authorEmail } },
    },
  })
  res.json(result)
})
```

### 3.4. Adjusting the `/publish/:id` route (`PUT`)

With the Prisma Client JS API, the `/publish/:id` route for `PUT` requests has to be changed to:

```ts
app.put('/publish/:id', async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.update({
    where: { id },
    data: { published: true },
  })
  res.json(post)
})
```

### 3.5. Adjusting the `/post/:id` route (`DELETE`)

With the Prisma Client JS API, the `//post/:id` route for `DELETE` requests has to be changed to:

```ts
app.delete(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.delete({ 
    where: { id }
   })
  res.json(post)
})
```

### 3.6. Adjusting the `/post/:id` route (`GET`)

With the Prisma Client JS API, the `/post/:id` route for `GET` requests has to be changed to:

```ts
app.get(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.findOne({ 
    where: { id }
   })
  res.json(post)
})
```

### 3.7. Adjusting the `/feed` route (`GET`)

With the Prisma Client JS API, the `/feed` route for `GET` requests has to be changed to:

```ts
app.get('/feed', async (req, res) => {
  const posts = await prisma.post.findMany({ where: { published: true } })
  res.json(posts)
})
```

### 3.8. Adjusting the `/filterPosts` route (`GET`)

With the Prisma Client JS API, the `/user` route for `POST` requests has to be changed to:

```ts
app.get('/filterPosts', async (req, res) => {
  const { searchString } = req.query
  const filteredPosts = await prisma.post.findMany({
    where: {
      OR: [
        {
          title: { contains: searchString }
        },
        {
          content: { contains: searchString }
        },
      ],
    },
  })
  res.json(filteredPosts)
})
```

## 4. Performing database migrations with Prisma Migrate

Going forward, you won't perform schema migrations using the `prisma deploy` command any more. Instead, you can use the `prisma2 migrate` commands. Every schema migration follows a 3-step-process:

1. Adjust the data model inside your Prisma schema to reflect the desired change (e.g. adding a new model)
1. Run `npx prisma2 migrate save --experimental` to save the migration on your file system (this doesn't perform the migration yet)
1. Run `npx prisma2 migrate up --experimental` to actually perform the migration against your database

> **Warning**: Prisma Migrate is currently in an **experimental** state. When using any of the commands below, you need to explicitly opt-in via an `--experimental` flag, e.g. `prisma2 migrate save --name 'init' --experimental`.

## Summary

In this upgrade guide, you learned how to upgrade an ExpressJS-based REST API from Prisma 1 to Prisma 2 that uses Prisma Client JS and Prisma Migrate. In the future, we'll cover more fine-grained upgrade scenarios, based on more complicated database schemas as well as for projects that are using GraphQL Nexus and `nexus-prisma`.
