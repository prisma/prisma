# The Prisma 2 tutorial

In this tutorial, you will get a holistic and practical introduction to the Prisma 2 ecosystem. This includes using [**Lift**](http://lift.prisma.io) for database migrations and [**Photon.js**](http://photonjs.prisma.io) for type-safe database access.

> **Note**: If you encounter any problems with this tutorial or any parts of Prisma 2, **please make sure to [create an issue](https://github.com/prisma/prisma2/issues)**! You can also join the [`#prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on Slack to share your feedback directly.

This tutorial will teach you how to:

1. Install the Prisma 2 CLI
1. Use the `init` command to set up a new project
1. Use the `dev` command for development
1. Migrate your database schema using the `lift` subcommands
1. Explore Photon's relation API

We will start from scratch and use **TypeScript** with a **PostgreSQL** database in this tutorial. You can set up your PostgreSQL database [locally](https://www.robinwieruch.de/postgres-sql-macos-setup/) or using a hosting provider such as [Heroku](https://elements.heroku.com/addons/heroku-postgresql) or [Digital Ocean](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-postgresql-on-ubuntu-18-04). The PostgreSQL database used in this tutorial is hosted on Heroku.

> **Note**: If you don't want to set up a PostgreSQL database, you can still follow along by choosing SQLite when running through the flow of the `prisma2 init` command. One of Prisma's main benefits is that it lets you easily swap out the data sources your application connects to. So, while you can start with SQLite, mapping the same setup to PostgreSQL later on can be done by simply adjusting a few lines in your [Prisma schema file](./prisma-schema-file.md).

## 1. Install the Prisma 2 CLI

The Prisma 2 CLI is available as the `prisma2` package on npm. Install it globally on your machine with the following command:

```
npm install -g prisma2
```

## 2. Connect your database

### 2.1. Launch the `prisma2 init` wizard

The `init` command of the Prisma 2 CLI helps you set up a new project and connect to a database. Run it as follows:

```
prisma2 init hello-prisma2
```

This launches an interactive wizard to help you with your set up, follow the steps below.

When prompted by the wizard, select the **Blank project** option. 

![](https://imgur.com/zLOFcCO.png)

### 2.2. Select your database type

Next, the wizard prompts you to select a database.

1. Select **PostgreSQL** (or use SQLite if you don't have a PostgreSQL database)

![](https://imgur.com/Ktx0oB8.png)

### 2.3. Provide your database credentials

1. Provide your database credentials:
    - **Host**: IP address or domain where your PostgreSQL server is running
    - **Port**: Port on which your PostgreSQL server is listening, typically `5432`
    - **User** and **Password**: Credentials of your database user
    - **Database**: Name of the [PostgreSQL database](https://www.postgresql.org/docs/current/tutorial-createdb.html) you want to use
    - **Schema** (optional): The name of the [PostgreSQL schema](https://www.postgresql.org/docs/current/ddl-schemas.html) you want to use (if you provide a schema name that doesn't exist, Prisma will create the schema for you; if not provided, you can select an existing schema in the next step)
    - **SSL**: Check the box if you PostgreSQL server uses SSL (likely yes if you're not running locally); you can toggle it with <kbd>SPACE</kbd>
1. Confirm with **Connect**

![](https://imgur.com/IOd3cDD.png)

This screenshot shows the configuration of a database hosted on Heroku. Note that we provide the name `hello-prisma2` for the **Schema** field. Since this schema doesn't exist yet in the provided `d8q8dvp22kfpo3` database, the Prisma 2 CLI will create a schema with that name. 

### 2.4. Select programming language for Photon

Photon is a type-safe database client that currently supports JavaScript and TypeScript (this variant is called Photon.js). You'll be using the TypeScript version in this tutorial.

Hence, select **TypeScript** when prompted by the wizard.

![](https://imgur.com/iTNmLG9.png)

### 2.5. Select the demo script

The wizard offers the option to start with a _demo script_. Selecting this option will get you started with a sample [data model definition](./data-modeling#data-model-definition) as well as an executable script which you can use to explore some Photon.js API calls. 

Select **Demo script** when prompted by the wizard.

![](https://imgur.com/PmnkqV6.png)

### 2.6. Explore next steps

Once you selected the **Demo script** option, the wizard will terminate its work and prepare your project:

![](https://imgur.com/OSslXH5.png)

It also prints a success message and next steps for you to take:

![](https://imgur.com/xK3c2HH.png)

Hold back a second before running the commands that are printed in the terminal!

## 3. Explore your project setup

The `prisma2 init`-wizard created the following directory structure:

```
hello-prisma2
├── node_modules
│   └── @generated
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

### 3.1. Understand the Prisma schema file

At the core of each project that uses Photon and/or Lift, there is the [Prisma schema file](./prisma-schema-file.md) (typically called `prisma.schema`). Here's what your Prisma schema currently looks like:

```prisma
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

```prisma
datasource db {
  provider = "postgresql"
  url      = "postgresql://opnmyfngbknppm:XXX@ec2-46-137-91-216.eu-west-1.compute.amazonaws.com:5432/d50rgmkqi2ipus?schema=hello-prisma2"
}
```

When running PostgreSQL locally, your user and password as well as the database name typically correspond to the current _user_ of your OS, e.g.:

```prisma
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
- [Data model definition](./data-modeling.md#data-model-definition) (the `Post` and `User` models)

## 4. Understand the data model definition

The [data model definition](./data-modeling.md#data-model-definition) inside the schema file has the following responsibilities:

- It's a _declarative_ description of your underlying database schema
- It provides the foundation for the generated [Photon API](./photon/api)

Its main building blocks are [models](./data-modeling.md#models) which map to _tables_ in the underlying PostgreSQL database. The [fields](./data-modeling.md#fields) of a model map to _columns_ of a table.

Consider the sample `User` model in your schema file:

```prisma
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
- The `posts` field is of type `Post[]` and denotes a [relation](./relations) to the `Post` model. The `[]` is expressing that this field is a _list_ (i.e. a user can have _many_ posts).

Also take a quick look at the `Post` model:

```prisma
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

## 5. Migrate your database using Lift

Every schema migration with Lift follows a 3-step-process:

1. **Adjust data model**: Change your [data model definition](./data-modeling.md#data-model-definition) to match your desired database schema.
1. **Save migration**: Run `prisma2 lift save` to create your [migration files](./lift/migration-files.md) on the file system.
1. **Run migration**: Run `prisma2 lift up` to perform the migration against your database.

Step 1 is what you just did in the previous section, so now you need to use Lift to map the data model to your database schema.

### 5.1. Save the migration on the file system

With Lift, every database migration gets persisted on your file system, represented by a number of [files](./lift/migration-files.md). This lets developers keep a migration history of their database and understand how their project evolves over time. It also enables rolling back and "replaying" migrations.

> **Note**: Lift also creates a table called `_Migration` in your database that additionally stores the details of every migration.

Run the following command to save your migrations files:

```
prisma2 lift save --name 'init'
```

This creates a new folder called `migrations`, including your first set of migration files:

```
hello-prisma2
└── prisma
    ├── migrations
    │   ├── 20190703131441-init
    │   │   ├── README.md
    │   │   ├── datamodel.prisma
    │   │   └── steps.json
    │   └── lift.lock
    └── schema.prisma
```

Note that the `--name` option that was passed to `prisma2 lift save` determines the name of the generated migration directory. To ensure uniqueness and retain order, the name of a migration directory is always prefixed with a timestamp, so in this case the migration directory is called `20190703131441-init`.

Feel free to explore the contents of each file to get a better understanding of their use.

### 5.2. Perform the database migration

Once the migration files are created, you can run the migration with the following command:

```
prisma2 lift up
```

This maps your data model to the underlying database schema (i.e. it _migrates your database_). In this case it created the following table:

```sql
CREATE TABLE "hello-prisma2"."User" (
    "id" text NOT NULL,
    "name" text,
    "email" text NOT NULL DEFAULT ''::text,
    PRIMARY KEY ("id")
);
```

That's it! You're now ready to access your database programmatically using Photon.js.

### 5.3. [Optional] Create a custom mapping from database to Prisma schema

When migrating your database based on this data model, Lift will map model and field names to table and column names. If you want to change the naming in the underlying database, you can use the `@@map` block attribute to specify a different table name, and the `@map` field attribute to specify a different column name. Expand below for an example.

<Details><Summary>Expand to see an example of <code>@@map</code> and <code>@map</code>.</Summary>

<br />

With the following model definition, the table in the underlying database will be called `users` and the column that maps to the `name` field is called `username`:

```prisma
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

## 6. Generate Photon.js

Photon.js is a type-safe database client for Node.js and TypeScript. It's generated from your [Prisma schema file](./prisma-schema-file.md) and provides an ergonomic data access API with CRUD and other operations for your [data model](./data-modeling.md#data-model-definition). You can learn more about Photon's generated API [here](./photon/api.md).

To generate Photon, you first need to add a `generator` to your schema file. Go ahead and adjust your `schema.prisma` to look as follows:

```diff
datasource db {
  provider = "postgresql"
  url      = "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
}

+ generator photonjs {
+   provider = "photonjs"
+ }

model User {
  id    String  @id @default(cuid())
  name  String?
  email String  @unique
}
```

With the `generator` in place, run the following command to generate Photon.js:

```
prisma2 generate
```

This creates a `node_modules` directory in the root directory of your project:

```
├── node_modules
│   └── @generated
│       └── photon
│           └── runtime
│               ├── dist
│               └── utils
└── prisma
    └── migrations
        └── 20190703131441-init
```

You can also add the `output` field to the `generator` block to specify the file path where Photon.js should be generated. Since you're not explicitly specifying the `output` here, it uses the default path which is the project's `node_modules` directory. Learn more about the specifics of generating Photon into `node_modules` [here](./photon/codegen-and-node-setup.md).

Having Photon.js located inside `node_modules/@generated` enables you to import it in your code as follows:

```ts
import Photon from '@generated/photon'
```

or

```js
const Photon = require('@generated/photon')
```

### 7.4. Adding a `postinstall` script to (re-)generate Photon.js

Because Photon.js is generated into `node_modules` which is typically populated by invoking `npm install`, you should make sure that Photon.js is also generated upon every invocation of `npm install`. You can do so by adding a `postinstall` script to your `package.json`:

```diff
{
  "name": "local-postgres-test-2",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {},
  "devDependencies": {
    "ts-node": "^8.3.0",
    "typescript": "^3.5.2"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "ts-node index.ts",
+   "postinstall": "prisma2 generate"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

When collaborating on a project that uses Photon.js, this approach allows for conventional Node.js best practices where a team member can clone a Git repository and then run `npm install` to get their version of the Node dependencies inside their local `node_modules` directory.

That's it! Let's now explore how you can use Photon inside `index.ts` to read and write data in the database.

### 7.5. Create a basic setup

Add the following code to `index.ts`:

```ts
import Photon from '@generated/photon'

const photon = new Photon()

async function main() {

  // Open connection to database
  await photon.connect()

  // You'll write your Photon code here

    // Close connection to database
  await photon.disconnect()
}

main()
```

Photon's operations are asynchronous, this is why we want to execute them in an `async` function (so that we can `await` the result of the operation). 

### 7.6. Use Photon for basic reads and writes

Add the following operations inside the `main function:

```ts
async function main() {

  // Open connection to database
  await photon.connect()

  const newUser = await photon.users.create({
    data: {
      name: 'Alice',
      email: 'alice@prisma.io'
    }
  })
  console.log(newUser)

  const allUsers = await photon.users.findMany()
  console.log(allUsers)

  // Close connection to database
  await photon.disconnect()
}
```

Instead of copying and pasting the code above, try typing the operations and let yourself be guided by the autocompletion in your editor:

![](https://imgur.com/CnlgJg9.gif)

You can now run the script with the following command:

```
npm start
```

This first creates a new `User` record in the database and subsequently fetches all users to print them in the console.

## 8. Evolve your application in Prisma's development mode

Prisma 2 features a [development mode](./development-mode.md) that allows for faster iterations during development. When running in development mode, the Prisma 2 CLI watches your [schema file](./prisma-schema-file.md). Whenever you then save a change to the schema file, the Prisma CLI takes care of:

- (re)generating Photon
- updating your database schema
- creating a Prisma Studio endpoint for you

Note that your database schema gets updated "on the fly" without persisting a migration folder on the file system. Once you're happy with the changes you made to your data model to develop a certain feature, you can exit the development mode and actually persist your migration. Learn more [here](./development-mode.md#migrations-in-development-mode).

Launch the development mode with this command:

```
prisma2 dev
```

> **Note**: You can stop the development mode by hitting <kbd>CTRL</kbd>+<kbd>C</kbd> two times.

Here is what the terminal screen now looks like:

![](https://imgur.com/aX3Qxpd.png)

### 8.1. Add another model

Let's now evolve the application while running the development mode. Add another model to your `schema.prisma`:

```prisma
model Post {
  id        String  @id @default(cuid())
  title     String
  published Boolean @default(false)
}
```

Be sure to **save the file**. You can then observe your terminal window to see Prisma's activity:

- It added a `Post` table to your database schema
- It regenerated the Photon API to add CRUD operations for the new `Post` model

To validate that this worked, you can update the code inside your `main` function in `index.ts` as follows:

```ts
async function main() {

  // Open connection to database
  await photon.connect()

  const newPost = await photon.posts.create({
    data: { title: 'Hello Prisma 2' }
  })
  console.log(newPost)

  const allPosts = await photon.posts.findMany()
  console.log(allPosts)

  // Close connection to database
  await photon.disconnect()
}
```

Execute the updated script:

```
npm run start
```

This now creates a new `Post` record in the database. 

### 8.2. Explore your data in Prisma Studio

You can explore the current content of your database using Prisma Studio. Open the endpoint that's shown in your terminal where `prisma dev` is running (in most cases this will be [`http://localhost:5555/`](http://localhost:5555/)).

![](https://imgur.com/2WH0MrA.png)

> **Note**: Please share your feedback about Prisma Studio in the [`studio`](https://github.com/prisma/studio) repository.

### 8.3. Add a relation

You already have two models in your [data model definition](./data-modeling.md#data-model-definition), let's now _connect_ these via a [relation](./relations.md):

- One post should have at most one author
- One author should have zero or more posts

To reflect these requirements, adjust your data model as follows:

```diff
model User {
  id    String  @id @default(cuid())
  name  String?
  email String  @unique
+ posts Post[]
}

model Post {
  id        String  @id @default(cuid())
  title     String
  published Boolean @default(true)
+ author    User?
}
```

Again, be sure to save the file to let Prisma update your database schema and regenerate the Photon API.

### 8.4. Terminate development mode and migrate with Lift

Terminate the development mode by hitting <kbd>CTRL</kbd>+<kbd>C</kbd> two times.

You've introduced two changes to your data model that are already reflected in the database and in your Photon API thanks to `prisma dev`. To persists your migration in Lift's migration history, you need to run through the familiar process of migrating your database with Lift:

```
prisma2 lift save --name 'add-post'
prisma2 lift up
```

## 9. Explore Photon's relation API

Coming soon. In the meantime, you can learn more about Photon's relations API [here](./relations.md#relations-in-the-generated-photon-api).
