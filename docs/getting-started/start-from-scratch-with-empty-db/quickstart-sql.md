# Quickstart: SQL 

## Overview

Select your database to get started:

- [PostgreSQL](#postgresql)
- [MySQL](#mysql)
- [SQLite](#sqlite)

## PostgreSQL

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
1. Run `touch schema.sql` to create your SQL schema and add the following contents to it:
    ```sql
    CREATE TABLE "public"."User" (
      user_id SERIAL PRIMARY KEY NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL
    );

    CREATE TABLE "public"."Post" (
      post_id SERIAL PRIMARY KEY NOT NULL,
      -- created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      author_id INTEGER,
      FOREIGN KEY (author_id) REFERENCES "public"."User"(user_id)
    );

    CREATE TABLE "public"."Profile" (
      profile_id SERIAL PRIMARY KEY NOT NULL,
      bio TEXT,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES "public"."User"(user_id)
    );
    ```
1. Run the following command to migrate your database schema:
    ```
    psql -h __HOST__ -d __DATABASE__ -U __USER__ -f schema.sql
    ```
    Note that you need to replace the uppercase placeholders with your database credentials, e.g.:
    ```
    psql -h localhost -d hello-prisma -U janedoe -f schema.sql 
    ```
1. Add a `generator` to the Prisma schema to be able to generate Prisma Client:
    ```prisma
    generator client {
      provider = "prisma-client-js"
    }
    ```
1. Configure project (TypeScript):
    ```
    npm init -y
    npm install typescript ts-node prisma2 --save-dev
    npm install @prisma/client
    ```
1. Run `npx prisma2 introspect` to introspect your database and add your models to the Prisma schema
1. Run `npx prisma2 generate` to generate Prisma Client
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

## MySQL

Follow these steps for an initial Prisma setup:

1. Run `mkdir hello-prisma` to create your project directory
1. Run `cd hello-prisma` to navigate into it
1. Run `touch schema.prisma` to create an empty [Prisma schema](../../prisma-schema-file.md)
1. Add a `datasource` to the Prisma schema and set your database connection string as the `url`, e.g.:
    ```prisma
    datasource db {
      provider = "mysql"
      url      = "mysql://root:admin@localhost:3306/hello-prisma"
    }
    ```
1. Run `touch schema.sql` to create your SQL schema and add the following contents to it:
    ```sql
    CREATE TABLE User (
      user_id BIGINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL,
      PRIMARY KEY (user_id)
    );

    CREATE TABLE Post (
      post_id BIGINT NOT NULL AUTO_INCREMENT,
      -- created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      author_id BIGINT,
      PRIMARY KEY (post_id),
      FOREIGN KEY (author_id) REFERENCES User(user_id)
    );

    CREATE TABLE Profile (
      profile_id BIGINT NOT NULL AUTO_INCREMENT,
      bio TEXT,
      user_id BIGINT NOT NULL,
      PRIMARY KEY (profile_id),
      FOREIGN KEY (user_id) REFERENCES User(user_id)
    );
    ```
1. Run the following command to migrate your database schema:
    ```
    mysql -u __USER__ -p __DATABASE__ < schema.sql
    ```
    Note that you need to replace the uppercase placeholders with your database credentials, e.g.:
    ```
    mysql -u root -p hello-prisma < schema.sql  
    ```
1. Add a `generator` to the Prisma schema to be able to generate Prisma Client:
    ```prisma
    generator client {
      provider = "prisma-client-js"
    }
    ```
1. Configure project (TypeScript):
    ```
    npm init -y
    npm install typescript ts-node prisma2 --save-dev
    npm install @prisma/client
    ```
1. Run `npx prisma2 introspect` to introspect your database and add your models to the Prisma schema
1. Run `npx prisma2 generate` to generate Prisma Client
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


## SQLite

Follow these steps for an initial Prisma setup:

1. Run `mkdir hello-prisma` to create your project directory
1. Run `cd hello-prisma` to navigate into it
1. Run `touch schema.prisma` to create an empty [Prisma schema](../../prisma-schema-file.md)
1. Add a `datasource` to the Prisma schema and set your database connection string as the `url`, e.g.:
    ```prisma
    datasource db {
      provider = "sqlite"
      url      = "sqlite:./hello-prisma.db"
    }
    ```
1. Run `touch schema.sql` to create your SQL schema and add the following contents to it:
    ```sql
    CREATE TABLE User (
      user_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL
    );

    CREATE TABLE Post (
      post_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      -- created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      author_id INTEGER,
      FOREIGN KEY (author_id) REFERENCES User(user_id)
    );

    CREATE TABLE Profile (
      profile_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      bio TEXT,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES User(user_id)
    );
    ```
1. Run the following command to create your SQLite database file from `schema.sql`:
    ```
    sqlite3 hello-prisma.db < schema.sql 
    ```
1. Add a `generator` to the Prisma schema to be able to generate Prisma Client:
    ```prisma
    generator client {
      provider = "prisma-client-js"
    }
    ```
1. Configure project (TypeScript):
    ```
    npm init -y
    npm install typescript ts-node prisma2 --save-dev
    npm install @prisma/client
    ```
1. Run `npx prisma2 introspect` to introspect your database and add your models to the Prisma schema
1. Run `npx prisma2 generate` to generate Prisma Client
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

