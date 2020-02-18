# Quickstart: Prisma Migrate (experimental)

This page explains how to get started with Prisma from scratch by connecting it to an empty database. It uses Prisma Migrate to define and migrate your database schema.

> **Warning**: Prisma Migrate is currently in an **experimental** state. When using any of the commands below, you need to explicitly opt-in via an `--experimental` flag, e.g. `prisma2 migrate save --name 'init' --experimental`.

Follow these steps for an initial Prisma setup:

1. Run `mkdir hello-prisma` to create your project directory
1. Run `cd hello-prisma` to navigate into it
1. Run `touch schema.prisma` to create an empty [Prisma schema](../../prisma-schema-file.md)
1. Add a `datasource` to the Prisma schema and set your database connection string as the `url`, e.g.:
    ```prisma
    datasource db {
      provider = "postgresql"
      url      = "postgresql://janedoe:janedoe@localhost:5432/hello-prisma"
    }
    ```
1. Add your models to the Prisma schema, e.g.:
    ```prisma
    model Post {
      post_id    Int      @id @default(autoincrement())
      content    String?
      created_at DateTime @default(now())
      title      String
      author     User?
    }

    model Profile {
      profile_id Int     @id @default(autoincrement())
      bio        String?
      user       User
    }

    model User {
      user_id  Int       @id @default(autoincrement())
      email    String    @unique
      name     String?
      posts    Post[]
      profiles Profile[]
    }
    ```
1. Add a `generator` to the Prisma schema to be able to generate Prisma Client:
    ```prisma
    generator client {
      provider = "prisma-client-js"
    }
    ```
1. Run the following commands to configure your project (TypeScript):
    ```
    npm init -y
    npm install typescript ts-node prisma2 --save-dev
    npm install @prisma/client
    ```
1. Run `touch tsconfig.json` and the following contents to it:
    ```json
    {
      "compilerOptions": {
        "sourceMap": true,
        "outDir": "dist",
        "strict": true,
        "lib": ["esnext", "dom"],
        "esModuleInterop": true
      }
    }
    ```
1. Migrate your database by running the following commands:
    ```
    npx prisma2 migrate save --name 'init' --experimental
    npx prisma2 migrate up --experimental
    ```
1. Generate Prisma Client based on your data model with the following command:
   ```
   npx prisma2 generate
   ```
1. Run `touch index.ts` to create a source file and add the following code:
    ```ts
    import { PrismaClient } from '@prisma/client'

    const prisma = new PrismaClient()

    // A `main` function so that we can use async/await
    async function main() {
      const user1 = await prisma.user.create({
        data: {
          email: 'alice@prisma.io',
          name: 'Alice',
          posts: {
            create: {
              title: 'Watch the talks from Prisma Day 2019',
              content: 'https://www.prisma.io/blog/z11sg6ipb3i1/',
            },
          },
        },
        include: {
          posts: true,
        },
      })
      console.log(user1)
    }

    main()
      .catch(e => console.error(e))
      .finally(async () => {
        await prisma.disconnect()
      })
    ```
1. Run `npx ts-node index.ts` to execute the script
