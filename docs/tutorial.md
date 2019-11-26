# The Prisma Framework tutorial

In this tutorial, you will get a holistic and practical introduction to the Prisma Framework ecosystem. This includes using [**Lift**](http://lift.prisma.io) for database migrations and [**Photon.js**](http://photonjs.prisma.io) for type-safe database access.

> **Note**: If you encounter any problems with this tutorial or any parts of the Prisma Framework, **please make sure to [create an issue](https://github.com/prisma/prisma2/issues)**! You can also join the [`#prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on Slack to share your feedback directly.

This tutorial will teach you how to:

1. Use the `init` command to set up a new project
1. Understand the essential parts of a Prisma project setup
1. Use the `dev` command for development
1. Migrate your database schema using the `lift` subcommands

We will start from scratch and use **TypeScript** with a **PostgreSQL** database in this tutorial. You can set up your PostgreSQL database [locally](https://www.robinwieruch.de/postgres-sql-macos-setup/) or using a hosting provider such as [Heroku](https://elements.heroku.com/addons/heroku-postgresql) or [Digital Ocean](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-postgresql-on-ubuntu-18-04). The PostgreSQL database used in this tutorial is hosted on Heroku.

> **Note**: If you don't want to set up a PostgreSQL database, you can still follow along by choosing SQLite when running through the flow of the `prisma2 init` command. One of Prisma's main benefits is that it lets you swap out the data sources your application connects to. So, while you can start with SQLite, mapping the same setup to PostgreSQL later on can be done by adjusting a few lines in your [Prisma schema file](./prisma-schema-file.md).

## 1. Set up a new project

### 1.1. Launch the `prisma2 init` wizard

The `init` command of the Prisma Framework CLI helps you set up a new project and connect to a database. Run it using [`npx`](https://github.com/npm/npx):

```
npx prisma2 init hello-prisma2
```

This launches an interactive wizard to help you with your set up, follow the steps below.

When prompted by the wizard, select the **Blank project** option. 

![](https://imgur.com/zLOFcCO.png)

### 1.2. Select your database type

Next, the wizard prompts you to select a database. Select **PostgreSQL** (or use SQLite if you don't have a PostgreSQL database running anywhere).

![](https://imgur.com/Ktx0oB8.png)

### 1.3. Provide your database credentials

Note that you can skip this part if you've selected SQLite before.

1. Provide your database credentials:
    - **Host**: IP address or domain where your PostgreSQL server is running
    - **Port**: Port on which your PostgreSQL server is listening, typically `5432`
    - **User** and **Password**: Credentials of your database user
    - **Database**: Name of the [PostgreSQL database](https://www.postgresql.org/docs/current/tutorial-createdb.html) you want to use
    - **Schema** (optional): The name of the [PostgreSQL schema](https://www.postgresql.org/docs/current/ddl-schemas.html) you want to use (if you provide a schema name that doesn't exist, Prisma will create the schema for you; if not provided, you can select an existing schema in the next step)
    - **SSL**: Check the box if your PostgreSQL server uses SSL (likely yes if you're not running locally); you can toggle it with <kbd>SPACE</kbd>
1. Confirm with **Connect**

![](https://imgur.com/IOd3cDD.png)

This screenshot shows the configuration of a database hosted on Heroku. Note that we provide the name `hello-prisma2` for the **Schema** field. Since this schema doesn't exist yet in the provided `d8q8dvp22kfpo3` database, the Prisma Framework CLI will create a schema with that name. 

### 1.4. Select programming language for Photon

Photon is a type-safe database client that currently supports JavaScript and TypeScript (this variant is called Photon.js). You'll be using the TypeScript variant in this tutorial.

Hence, select **TypeScript** when prompted by the wizard.

![](https://imgur.com/iTNmLG9.png)

### 1.5. Select the demo script

The wizard offers the option to start with a _demo script_. Selecting this option will get you started with a sample [data model definition](./data-modeling.md#data-model-definition) as well as an executable script which you can use to explore some Photon.js API calls. 

Select **Demo script** when prompted by the wizard.

![](https://imgur.com/PmnkqV6.png)

### 1.6. Explore next steps

Once you selected the **Demo script** option, the wizard will terminate its work and prepare your project:

![](https://imgur.com/OSslXH5.png)

It also prints a success message and next steps for you to take:

![](https://imgur.com/xK3c2HH.png)

Hold back a second before running the commands that are printed in the terminal!

## 2. Explore your project setup

The `prisma2 init`-wizard created the following directory structure:

```
hello-prisma2
├── node_modules
│   └── @prisma
│       └── photon
├── package.json
├── prisma
│   ├── migrations
│   │   └── dev
│   │       └── watch-20190903103132
│   │           ├── README.md
│   │           ├── schema.prisma
│   │           └── steps.json
│   └── schema.prisma
├── script.ts
└── tsconfig.json
```

Let's go through the created files.

### 2.1. Understand the Prisma schema file

At the core of each project that uses Photon and/or Lift, there is the [Prisma schema file](./prisma-schema-file.md) (typically called `schema.prisma`). Here's what your Prisma schema currently looks like:

```groovy
generator photon {
  provider = "photonjs"
}

datasource db {
  provider = "postgresql"
  url      = "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
}

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
  published Boolean
  title     String
  content   String?
  author    User?
}
```

The uppercase letters in the `datasource` configuration are placeholders representing your database credentials. 

For a PostgreSQL database hosted on Heroku, the [connection string](./core/connectors/postgresql.md#connection-string) might look similar to this:

```groovy
datasource db {
  provider = "postgresql"
  url      = "postgresql://opnmyfngbknppm:XXX@ec2-46-137-91-216.eu-west-1.compute.amazonaws.com:5432/d50rgmkqi2ipus?schema=hello-prisma2"
}
```

When running PostgreSQL locally, your user and password as well as the database name typically correspond to the current _user_ of your OS, e.g.:

```groovy
datasource db {
  provider = "postgresql"
  url      = "postgresql://johndoe:johndoe@localhost:5432/johndoe?schema=hello-prisma2"
}
```

Note that it's also possible to provision the `url` as an [environment variable](./prisma-schema-file.md#using-environment-variables).

Depending on where your PostgreSQL database is hosted or if you're using SQLite, the `datasource` configuration will look different in your schema file.

The Prisma schema contains three important elements of your project:

- Data sources (here, that's your PostgreSQL database)
- Generators (here, that's the generator for Photon.js)
- [Data model definition](./data-modeling.md#data-model-definition) (here, that's the `Post` and `User` models)

### 2.2. Understand the data model definition

The [data model definition](./data-modeling.md#data-model-definition) inside the schema file has the following responsibilities:

- It's a _declarative_ description of your underlying database schema
- It provides the foundation for the generated [Photon API](./photon/api.md)

Its main building blocks are [models](./data-modeling.md#models) which map to _tables_ in the underlying PostgreSQL database. The [fields](./data-modeling.md#fields) of a model map to _columns_ of a table.

Consider the sample `User` model in your schema file:

```groovy
model User {
  id    String  @default(cuid()) @id
  email String  @unique
  name  String?
  posts Post[]
}
```

This defines a model `User` with four fields:

- The `id` field is of type `String` and annotated with two [attributes](./data-modeling.md#attributes):
  - `@id`: Indicates that this field is used as the _primary key_
  - `@default(cuid())`: Sets a default value for the field by generating a [`cuid`](https://github.com/ericelliott/cuid)
- The `email` field is of type `String`. It is annotated with the `@unique` attribute which means that there can never be two records in the database with the same value for that field. This will be enforced by Prisma.
- The `name` field is of type `String?` (read: "optional string"). The `?` is a [type modifier](#type-modifiers) expressing that this field is _optional_.
- The `posts` field is of type `Post[]` and denotes a [relation](./relations.md) to the `Post` model. The `[]` is expressing that this field is a _list_ (i.e. a user can have _many_ posts).

Also take a quick look at the `Post` model:

```groovy
model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}
```

Most of this should look familiar from what you just learned about the `User` model, but there are a few new things:

- The `createdAt` field is of type `DateTime`. The `@default(now())` attribute it's annotated with means that the field will get initialized with the current timestamp representing the time the record is being created.
- The `updatedAt` field is annotated with the `@updatedAt` attribute. Prisma will update this field with the current timestamp whenever any field of the model gets updated.

### 2.3. Understand the TypeScript setup

The project also contains a number of additional files required for a typical Node.js/TypeScript setup:

- `package.json`: Defines your project's Node.js dependencies.
- `tsconfig.json`: Specifies your TypeScript configuration. Note that Photon.js currently requires the `esModuleInterop` property to be set to `true`.
- `node_modules/@prisma/photon`: Contains the generated Photon.js code. 
- `script.ts`: Contains the actual "application code", which in this case is a sample script demonstrating some Photon.js API calls.

Having Photon.js located inside `node_modules/@prisma/photon` enables you to import it in your code as follows:

```ts
import { Photon } from '@prisma/photon'
```

Because Photon.js is generated into `node_modules` which is typically populated by invoking `npm install`, you should make sure that Photon.js is also generated upon every invocation of `npm install`. That's the reason why `prisma2 generate` (the command that generates Photon.js based on the Prisma schema) is added as a `postinstall` hook in `package.json`:

```json
{
  "name": "script",
  "license": "MIT",
  "dependencies": {
    "@prisma/photon": "2.0.0-preview-017"
  },
  "devDependencies": {
    "ts-node": "8.3.0",
    "typescript": "3.6.2",
    "prisma2": "2.0.0-preview-017"
  },
  "scripts": {
    "start": "ts-node ./script.ts",
    "postinstall": "prisma2 generate"
  }
}
```

When collaborating on a project that uses Photon.js, this approach allows for conventional Node.js best practices where a team member can clone a Git repository and then run `npm install` to get their version of the Node dependencies inside their local `node_modules` directory.

Note that the version of the `@prisma/photon` and `prisma2` packages must always be in sync!

### 2.4. Understand the `migrations` folder

To keep a migration history, Prisma by default uses a folder called `migrations`. There are two ways how the `migrations` folder gets populated:

- Whenever the data model in _development mode_, a new migration is generated into `migrations/dev`.
- Whenever a data model change is to be persisted using Lift, it gets its own directory.

Don't worry, you'll learn more about both approaches in the next sections. Note that there already is a first migration called `watch-TIMESTAMP` (where `TIMESTAMP` is a placeholder, the real name looks something like `watch-20190903103132`) in the `dev` folder. This is because Prisma already prepared the project for you to be able to run the demo script immediately, that is it migrated the database to match your data model definition (i.e. there's already a `Post` and a `User` table present in the database). You can validate this by exploring the database schema in a database GUI (like [Postico](https://eggerapps.at/postico/) or [TablePlus](https://tableplus.com/)):

![](https://imgur.com/Y3U6Csg.png)

Note that migrations in the `migrations/dev` folder are considered "throw away" migrations. If you want to evolve your database schema in a way that the migration is persisted in Lift's _migration history_, you need to perform a migration using the `lift` subcommands: `prisma2 lift save` and `prisma2 lift up`.

## 3. Run the demo script

Now, let's finally consider the _Next steps_ again that had been printed to the console after the `init` wizard terminated:

![](https://imgur.com/xK3c2HH.png)

The instructions say to navigate into the project directory, start Prisma's development mode and finally execute the demo script. You'll skip the `prisma2 dev` command for now though and run the `script.ts` script. Before doing so, let's quickly take a look at its contents:

```ts
import { Photon } from '@prisma/photon'

const photon = new Photon()

// A `main` function so that we can use async/await
async function main() {
  // Seed the database with users and posts
  const user1 = await photon.users.create({
    data: {
      email: 'alice@prisma.io',
      name: 'Alice',
      posts: {
        create: {
          title: 'Watch the talks from Prisma Day 2019',
          content: 'https://www.prisma.io/blog/z11sg6ipb3i1/',
          published: true,
        },
      },
    },
    include: {
      posts: true,
    },
  })
  const user2 = await photon.users.create({
    data: {
      email: 'bob@prisma.io',
      name: 'Bob',
      posts: {
        create: [
          {
            title: 'Subscribe to GraphQL Weekly for community news',
            content: 'https://graphqlweekly.com/',
            published: true,
          },
          {
            title: 'Follow Prisma on Twitter',
            content: 'https://twitter.com/prisma/',
            published: false,
          },
        ],
      },
    },
    include: {
      posts: true,
    },
  })
  console.log(`Created users: ${user1.name} (${user1.posts.length} post) and (${user2.posts.length} posts) `)

  // Retrieve all published posts
  const allPosts = await photon.posts.findMany({
    where: { published: true },
  })
  console.log(`Retrieved all published posts: `, allPosts)

  // Create a new post (written by an already existing user with email alice@prisma.io)
  const newPost = await photon.posts.create({
    data: {
      title: 'Join the Prisma Slack community',
      content: 'http://slack.prisma.io',
      published: false,
      author: {
        connect: {
          email: 'alice@prisma.io',
        },
      },
    },
  })
  console.log(`Created a new post: `, newPost)

  // Publish the new post
  const updatedPost = await photon.posts.update({
    where: {
      id: newPost.id,
    },
    data: {
      published: true,
    },
  })
  console.log(`Published the newly created post: `, updatedPost)

  // Retrieve all posts by user with email alice@prisma.io
  const postsByUser = await photon.users
    .findOne({
      where: {
        email: 'alice@prisma.io',
      },
    })
    .posts()
  console.log(`Retrieved all posts from a specific user: `, postsByUser)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })
```

Here's a quick rundown of what's happening in the code:

1. Create two users named _Alice_ and _Bob_ using `photon.users.create(...)`
    - _Alice_ has one post titled _Watch the talks from Prisma Day 2019_
    - _Bob_ has two posts titled _Subscribe to GraphQL Weekly for community news_ and _Follow Prisma on Twitter_
1. Retrieve all _published_ posts using `photon.posts.findMany(...)`
1. Create a new post titled _Join the Prisma Slack community_ connected to the user _Alice_ by her email address
1. Publish _Alice_'s newly created post using `photon.posts.update(...)`
1. Retrieve all posts by _Alice_ using `photon.users.findOne(...).posts()`

Notice that the result of each of these operations is printed to the console using `console.log`.

Go ahead and run the code:

```
cd hello-prisma2
npm run dev
```

This leads to the following terminal output confirming that all operations ran successfully:

![](https://imgur.com/O5vX9iP.png)

If you're using a database GUI, you can also validate that all records have been created there.

## 4. Evolve your application in Prisma's development mode

The Prisma Framework features a [development mode](./development-mode.md) that allows for faster iterations during development. It can be invoked using the `prisma2 dev` command. When running in development mode, the Prisma Framework CLI watches your [schema file](./prisma-schema-file.md). Whenever you then save a change to the schema file, the Prisma CLI takes care of:

- (re)generating Photon
- updating your database schema
- creating a Prisma Studio endpoint for you

In essence, running `prisma2 dev` is a shortcut to immediately apply changes to your project that you'd otherwise have to perform through these commands:

- `prisma2 generate` to generate Photon
- `prisma2 lift save` and `prisma2 lift up` to apply a migration

Once you're happy with the changes you made to your data model to develop a certain feature, you can exit the development mode and actually persist your migration using Lift. Learn more [here](./development-mode.md#migrations-in-development-mode).

Go ahead now and launch the development mode with this command:

```
npx prisma2 dev
```

> **Note**: You can stop the development mode by hitting <kbd>CTRL</kbd>+<kbd>C</kbd> two times.

Here is what the terminal screen now looks like:

![](https://imgur.com/FxmFgbu.png)

### 4.1. Explore your data in Prisma Studio

You can explore the current content of your database using Prisma Studio. Open the endpoint that's shown in your terminal (in most cases this will be [`http://localhost:5555/`](http://localhost:5555/)):

![](https://imgur.com/4h9nk7i.png)

> **Note**: Please share any feedback you have about Prisma Studio in the [`studio`](https://github.com/prisma/studio) repository.

### 4.2. Add another model

Let's now evolve the application while running in development mode. You'll be adding a new model called `Category` to your schema. `Category` will be connected to `Post` via a [many-to-many](./relations.md#mn) relationship. Adjust the data model of your Prisma schema as follows:

```diff
model User {
  id    String  @default(cuid()) @id
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id         String     @default(cuid()) @id
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  published  Boolean
  title      String
  content    String?
  author     User?
+  categories Category[]
}

+ model Category {
+   id    String @id @default(cuid())
+   name  String
+   posts Post[]
+ }
```

Be sure to **save the file**. As you save it, you can observe your terminal window to see Prisma's activity:

- It added a `Category` table to your database schema. It also added a _relation table_ called `_CategoryToPost` to the database schema to represent the many-to-many relation. Note that the shape of the relation table will be configurable in the future, learn more in the [spec](https://github.com/prisma/specs/tree/master/schema#explicit-many-to-many-mn-relationships).
- It regenerated the Photon API to add CRUD operations for the new `Category` model.

Since the Photon API has been updated, you can now update the code in `script.ts` to create new categories and connect them to existing (or new) posts. As an example, this code snippet would create a new category called "prisma" and connect it to two existing posts:

```ts
const category = await photon.categories.create({
  data: { 
    name: "prisma",
    posts: {
      connect: [{
        id: "__POST_ID_1__"
      }, {
        id: "__POST_ID_2__"
      }]
    }
  },
})
```

If you want to try out this code snippet, here are a few things to consider:

- You need to replace the `__POST_ID_1__` and `__POST_ID_2__` placeholders with actual ID values of the posts you created earlier (you can find these IDs e.g. in Prisma Studio or using a database GUI).
- You need to remove the current code from the script (e.g. by commenting it out), otherwise it will try to re-create `User` records with the same email address which will fail.
- You can invoke the script using `npm run dev`.

### 4.3. Terminate development mode

Terminate the development mode by hitting <kbd>CTRL</kbd>+<kbd>C</kbd> two times.

## 5. Migrate the database with Lift

You've introduced changes to your data model that are already reflected in the database and in your Photon API thanks to `prisma2 dev`. To persists your migration in Lift's migration history, you need to run through the process of migrating your database with Lift.

Every schema migration with Lift follows a 3-step-process:

1. **Adjust data model**: Change your [data model definition](./data-modeling.md#data-model-definition) to match your desired database schema.
1. **Save migration**: Run `prisma2 lift save` to create your [migration files](./lift/migration-files.md) on the file system.
1. **Run migration**: Run `prisma2 lift up` to perform the migration against your database.

### 5.1. Save the migration on the file system

With Lift, every database migration gets persisted on your file system, represented by a number of [files](./lift/migration-files.md). This lets you keep a migration history of you database schema and understand how their project evolves over time. It also enables rolling back and "replaying" migrations.

> **Note**: Lift also creates a table called `_Migration` in your database that additionally stores the details of every migration.

Run the following command to save your migrations files:

```
npx prisma2 lift save --name 'add-category'
```

This deletes the "throw-away" migration files in the `migrations/dev` directory and creates a new directory inside `migrations` called `TIMESTAMP-add-category`:

```
hello-prisma2
├── README.md
├── node_modules
│   ├── @prisma
│   │   └── photon
├── package-lock.json
├── package.json
├── prisma
│   ├── migrations
│   │   ├── 20190904103007-add-category
│   │   │   ├── README.md
│   │   │   ├── schema.prisma
│   │   │   └── steps.json
│   │   └── lift.lock
│   └── schema.prisma
├── script.ts
├── tsconfig.json
└── yarn.lock
```

Note that the `--name` option that was passed to `prisma2 lift save` determines the name of the generated migration directory. To ensure uniqueness and retain order, the name of a migration directory is always prefixed with a timestamp, so in this case the migration directory is called `20190703131441-add-category`.

Feel free to explore the contents of each file to get a better understanding of their use.

### 5.2. Perform the database migration

Once the migration files are created, you can run the migration with the following command:

```
npx prisma2 lift up
```

This maps your data model to the underlying database schema (i.e. it _migrates your database_). 

### 5.3. [Optional] Create a custom mapping from database to Prisma schema

When migrating your database with Lift, it will typically map model and field names to table and column names. If you want to change the naming in the underlying database, you can use the `@@map` block attribute to specify a different table name, and the `@map` field attribute to specify a different column name. Expand below for an example.

<Details><Summary>Expand to see an example of <code>@@map</code> and <code>@map</code>.</Summary>

<br />

With the following model definition, the table in the underlying database will be called `users` and the column that maps to the `name` field is called `username`:

```groovy
model User {
  id    String  @id @default(cuid())
  name  String? @map("username")
  email String  @unique

  @@map("users")
}
```

Here is what the SQL statement looks like that's generated by Lift when the migration is performed:

```sql
CREATE TABLE "hello-prisma2"."users" (
    "id" text NOT NULL,
    "username" text,
    "email" text NOT NULL DEFAULT ''::text,
    PRIMARY KEY ("id")
);
```

</Details>

## 6. Next steps

Congratulations for working through your first Prisma tutorial 🚀 Here are a few pointers on what to do next:

- Explore some Prisma Framework example projects, e.g. for [REST](https://github.com/prisma/prisma-examples/tree/prisma2/typescript/rest-express), [GraphQL](https://github.com/prisma/prisma-examples/tree/prisma2/typescript/graphql) or [gRPC](https://github.com/prisma/prisma-examples/tree/prisma2/typescript/grpc) APIs.
- Join the [`#prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on the [Prisma Slack](https://slack.prisma.io)
- [Share any feedback you might have](https://github.com/prisma/prisma2/blob/master/docs/prisma2-feedback.md) on the Prisma Framework
- 🌟 Leave a GitHub star on this repo
- [Follow Prisma on Twitter](https://twitter.com/prisma) to stay in the loop for updates
