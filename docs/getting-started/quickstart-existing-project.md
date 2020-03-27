# Quickstart: Add Prisma to an existing project

This page explains how to get started with Prisma in an existing project. 

If you don't have a database to try Prisma or just want to explore everything from scratch, check out the ready-to-run [example projects](https://github.com/prisma/prisma-examples/) with use cases for REST, GraphQL, gRPC and more.

## TLDR

Follow these steps to use Prisma with your existing database. Note that these steps assume that you have an existing Node.js or TypeScript project (in case you don't, follow the [extended guide](#extended-guide) below):

1. Install the Prisma 2 CLI as a development dependency: `npm install @prisma/cli --save-dev`
1. Run `npx prisma2 init` to create an empty [Prisma schema](./prisma-schema-file.md)
1. Set the `url` of the `datasource` block in the Prisma schema to your database connection URL
1. Run `npx prisma2 introspect` to obtain your data model from the database schema
1. Run `npm install @prisma/client` to add the Prisma Client npm package to your project
1. Run `npx prisma2 generate` to generate Prisma Client
1. Import Prisma Client into your code: `import { PrismaClient } from '@prisma/client'`
1. Instantiate Prisma Client: `const prisma = new PrismaClient()`
1. Use Prisma Client in code (use your editor's auto-completion to explore its API)

> **Note**: If Prisma's introspection failed for your database schema, please [open an issue](https://github.com/prisma/prisma2/issues/new) and tell us what went wrong. If you want to help us make Prisma more resilient, please [share your database SQL schema with us](https://github.com/prisma/prisma2/issues/757) so we can add it to our introspection testing suite. 

## Extended guide

In this guide, we'll walk you through the steps from above in more detail. 

### Prerequisites

This guide is based on Prisma's [introspection](./introspection.md) feature which is constantly being improved. Right now, it still has the following limitations:

- Every column needs to have a primary key constraint on a single column ([multi-column primary keys are not yet supported](https://github.com/prisma/prisma-client-js/issues/339)). Introspection will fail if this is not the case. Note that this often makes it impossible to introspect a schema that uses relation tables (also sometimes called "join tables") as these typically don't have a single-column primary key.
- `ENUM` types are not yet supported. Introspection will succeed and ignore the `ENUM` types in your database schema.
- `TIMESTAMP WITH TIMEZONE` types are already supported via introspection (and mapped to Prisma's `DateTime` type) but [currently can't be queried with Prisma Client](https://github.com/prisma/prisma2/issues/1386).

### 1. Set up Prisma for your database

First, run the following command to create an empty Prisma schema file:

```
npx prisma2 init
```

This creates an empty Prisma schema looking similar to this:

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

It also creates a [`.env`](https://github.com/motdotla/dotenv) file that you can use to set your environment variables. Right now it contains a placeholder for your database connection URL defined as the `DATABASE_URL` environment variable.

```
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for Postgres, MySQL and SQLite.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

Next, you need to provide the connection URL of your database as the value for the `DATABASE_URL` environment variable in the `.env` file. This is needed so that Prisma can introspect your database schema and generate Prisma Client.

The format of the connection URL for your database typically depends on the database you use (the parts spelled all-uppercased are placeholders for your specific connection details):

- MySQL: `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
- PostgreSQL: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA`
- SQLite: `file:./FILE.db`

As an example, for a PostgreSQL database hosted on Heroku, the [connection string](./core/connectors/postgresql.md#connection-string) might look similar to this:

```
DATABASE_URL="postgresql://opnmyfngbknppm:XXX@ec2-46-137-91-216.eu-west-1.compute.amazonaws.com:5432/d50rgmkqi2ipus?schema=hello-prisma2"
```

When running PostgreSQL locally, your user and password as well as the database name typically correspond to the current _user_ of your OS, e.g.:

```
DATABASE_URL=""postgresql://janedoe:janedoe@localhost:5432/janedoe?schema=hello-prisma2""
```

> **Note**: If you're unsure what to provide for the `schema` parameter for a PostgreSQL connection URL, you can probably omit it. In that case, the default schema name `public` will be used.

### 2. Introspect your database to generate a data model

The next step is to run Prisma's introspection to obtain your data model:

```
npx prisma2 introspect
```

> **Note**: If Prisma's introspection failed for your database schema, please [open an issue](https://github.com/prisma/prisma2/issues/new) and tell us what went wrong. If you want to help us make Prisma more resilient, please [share your database SQL schema with us](https://github.com/prisma/prisma2/issues/757) so we can add it to our introspection testing suite. 

This command connects to your database and introspects its schema. Based on that schema, Prisma then adds a number of models to your Prisma schema file which represent the data model of your application. This data model will be the foundation for the generated data access API of Prisma Client.

For the purpose of this guide, we're using the following SQL schema:

```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY NOT NULL,
  name VARCHAR(256),
  email VARCHAR(256) UNIQUE NOT NULL
);

CREATE TABLE posts (
  post_id SERIAL PRIMARY KEY NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  title VARCHAR(256) NOT NULL,
  content TEXT,
  author_id INTEGER,
  FOREIGN KEY (author_id) REFERENCES users(user_id) 
);

CREATE TABLE profiles (
  profile_id SERIAL PRIMARY KEY NOT NULL,
  bio TEXT,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

Prisma's introspection generates the following data model for the SQL schema above:

```prisma
model posts {
  author_id  users?
  content    String?
  created_at DateTime?
  post_id    Int       @id
  title      String
}

model profiles {
  bio        String?
  profile_id Int     @id
  user_id    users
}

model users {
  email      String     @unique
  name       String?
  user_id    Int        @id
  posts      posts[]
  profiles   profiles[]
}
```

## 3. Generate Prisma Client

Prisma Client is an auto-generated and type-safe database client that's tailored to your database schema. Note that you'll need a Node.js/TypeScript project in order to generate Prisma Client since it relies the `@prisma/client` dependency. You'll use TypeScript for the purpose of this guide. 

If you don't have one already, run the following commands to create a simple TypeScript setup:

```
npm init -y
npm install typescript ts-node @types/node --save-dev
npm install @prisma/client
touch script.ts
touch tsconfig.json
```

Next, add the following contents to your `tsconfig.json`: 

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["esnext"],
    "strict": true
  },
  "include": ["src/**/*"]
}
```

Now you can generate Prisma Client:

```
npx prisma2 generate
```

Your Prisma Client API is now ready to be used in `node_modules/@prisma/client`.

## 4. Use Prisma Client to read and write data in your database

With your TypeScript setup in place, add the following code to `script.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {

  const users = await prisma.user.findMany({
    include: {
      posts: true,
    }
  })
  console.log(JSON.stringify(users))
}

main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.disconnect()
  })
```

This is a simple API call that fetches all the records from the `users` table. you can run the script with this command:

```
npx ts-node script.ts
```

If you've used your own database in this guide and are unsure what to query for, you can use your editor's auto-complection feature to help create a query by typing `prisma.` and then hit <kbd>CTRL</kbd>+<kbd>SPACE</kbd> to suggest any of your models as a starting point for the query. Once you selected a model and added another dot afterwards, you can again use the <kbd>CTRL</kbd>+<kbd>SPACE</kbd> to decide for an operation on the model (e.g. `findMany`, `create`, `update`, ...). After having selected the operation, you can once more invoke the auto-completion to explore the arguments to provide for the operation.

![](https://imgur.com/p4kdfhH.gif)

