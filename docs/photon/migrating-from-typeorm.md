# Tutorial: Migrating from TypeORM to Photon.js

[TypeORM](https://typeorm.io/) and [Photon.js](https://photonjs.prisma.io/) both act as abstraction layers between your application and your database, but each works differently under the hood and provides different types of abstractions. In this tutorial, we will compare both approaches for working with databases and walk through how to migrate from a TypeORM project to a Photon.js one.

> **Note**: If you encounter any problems with this tutorial or any parts of the Prisma Framework, this is how you can get help: **create an issue on [GitHub](https://github.com/prisma/prisma2/issues)** or join the [`#prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on [Slack](https://slack.prisma.io/) to share your feedback directly. We also have a community forum on [Spectrum](https://spectrum.chat/prisma).

## Goals

This tutorial will show you how to achieve the following in your migration process:
1. [Obtaining the Prisma schema from your database](#1-Introspecting-the-existing-database-schema-from-the-TypeORM-project)
2. [Defining the data source](#2-Specifying-the-data-source)
3. [Installing and importing the library](#3-Installing-and-importing-the-library)
4. [Setting up a connection](#4-Setting-up-a-connection)
5. [Modelling data](#5-Creating-models)
6. [Querying the database](#6-Querying-the-database)
7. [Setting up your TypeScript project](#7-Setting-up-your-TypeScript-project)
8. [Other migration considerations](#8-Other-considerations)

## Prerequisites

This tutorial assumes that you have some basic familiarity with:

- TypeScript
- Node.js
- PostgreSQL

You will use **TypeScript** with a **PostgreSQL** database in this tutorial. You can set up your PostgreSQL database [locally](https://www.robinwieruch.de/postgres-sql-macos-setup) or use a hosting provider such as [Heroku](https://elements.heroku.com/addons) or [Digital Ocean](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-postgresql-on-ubuntu-18-04).

- Make sure that your database server is [running](https://tableplus.com/blog/2018/10/how-to-start-stop-restart-postgresql-server.html)
- Know your database server credentials
- Have a database created for the tutorial 

You will be migrating a REST API built with the [Express](https://expressjs.com/) framework.  The example project can be found in this [repository](https://github.com/infoverload/migration_typeorm_photon). 

Clone the repository and navigate to it:

```
git clone https://github.com/infoverload/migration_typeorm_photon
cd migration_typeorm_photon
```

The TypeORM version of the project can be found in the [`typeorm`](https://github.com/infoverload/migration_typeorm_photon/tree/typeorm) branch.  To switch to the branch, type:

```
git checkout typeorm
```

The finished Photon.js version of the project is in the [`master`](https://github.com/infoverload/migration_typeorm_photon/tree/master) branch. To switch to this branch, type:

```
git checkout master
```

## 1. Introspecting the existing database schema from the TypeORM project

Follow the instructions in the [README file](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/README.md) in the [`typeorm`](https://github.com/infoverload/migration_typeorm_photon/tree/typeorm) branch and get the project running against your PostgreSQL database. This sets up your database and defines the schema as defined in the TypeORM [entities](https://github.com/infoverload/migration_typeorm_photon/tree/typeorm/src/entity) of the project.  

Prisma lets you [introspect](https://github.com/prisma/prisma2/blob/master/docs/introspection.md) your database to derive a data model definition from the current database schema.

Now you are ready to introspect the database from the TypeORM project.  Navigate outside of the current project directory so you can start a new project. In your terminal, type the command:

```
npx prisma2 init photonjs_app
```

This will initialize a new Prisma project name "photonjs_app" and start the init process:  

1. "Languages for starter kits": **Blank project**
2. "Supported databases": **PostgreSQL**
3. "PostgreSQL database credentials": fill in your database credentials and select **Connect**
4. "Database options": **Use existing PostgreSQL schema**
5. "Non-empty schemas": **public** 
6. "Prisma 2 tools": confirm the default selections 
7. "Photon is available in these languages": **TypeScript**
8. **Just the Prisma schema**

The introspection process is now complete.  You should see a message like:
```
 SUCCESS  The introspect directory was created!
 SUCCESS  Prisma is connected to your database at localhost
```

If you explore the project directory, you will see: 
```
prisma
└── schema.prisma
```

The [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md) is the main configuration file for your Prisma setup.  It holds the specifications and credentials for your database, your data model definition, and generators.  The migration process to Photon.js will all begin from this file. 

<Details>
<Summary>Have a look at the file that was generated.</Summary>

```groovy
generator photon {
  provider = "photonjs"
}

datasource db {
  provider = "postgresql"
  url      = "postgresql://user:password@127.0.0.1:5432/database?schema=public"
}

model Category {
  id                     Int                      @id
  name                   String
  postCategoriesCategory PostCategoriesCategory[]

  @@map("category")
}

model Post {
  id                     Int                      @id
  postCategoriesCategory PostCategoriesCategory[]
  text                   String
  title                  String

  @@map("post")
}

model PostCategoriesCategory {
  categoryId Category
  postId     Post

  @@map("post_categories_category")
}
```
</Details>

When introspecting a database with many-to-many relations, Prisma follows its own conventions for relation tables.  So when you introspected the existing database schema from the TypeORM project, you may encounter a bug specifying "Model PostCategoriesCategory does not have an id field" if you type `prisma2 dev`.  

This is a known [limitation](https://github.com/prisma/prisma2/blob/master/docs/limitations.md). A workaround is to add a primary key `id` field in the `PostCategoriesCategory` model manually in the [schema.prisma](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma#L28) file like this:

```diff
//...
model PostCategoriesCategory {
+ id         Int           @id
  //...
}
```

Now in your terminal, type:

```
npx prisma2 dev
```

This launches the [development mode](https://github.com/prisma/prisma2/blob/master/docs/development-mode.md) and creates a [Prisma Studio](https://github.com/prisma/studio) endpoint for you.  Go to the endpoint (i.e. http://localhost:5555 ) and explore the generated Prisma schema visually in your browser. 

![](https://i.imgur.com/nnnfql9r.png)

## 2. Specifying the data source

In the TypeORM project example, the data source and credentials can be defined in the [`ormconfig.json`](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/ormconfig.json) file:

```json
{
  "name": "default",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "username": "user",
  "password": "password",
  "database": "database",
  "synchronize": true,
  "logging": true
  
}
```
In your Photon.js project, this was automatically generated when you ran through the `prisma2 init` process and located in your [`schema.prisma`](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma) file:

```groovy
//...
datasource db {
  provider = "postgresql"
  url      = "postgresql://user:password@localhost:5432/database?schema=public"
}
//...
```

## 3. Installing and importing the library

TypeORM is installed as a [node module](https://www.npmjs.com/package/typeorm) with `npm install`, whereas Photon.js is generated by the Prisma CLI (which invokes a Photon.js generator) and provides a type-safe data access API for your data model.

### Installing the Prisma depedencies

Be sure to add the `@prisma/photon` package to your project dependencies as well as the `prisma2` package as a development dependency. Note that both package versions must be kept in sync:

```
npm install @prisma/photon
npm install prisma2 --save-dev
```

### Migrating to the Photon constructor

Make sure you are in your `photonjs_app` project directory. Then, in your terminal, run: 

```
npx prisma2 generate
```

This parses the Prisma schema file to generate the right data source client code (from reading the `generator` definition): 

[schema.prisma](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma)
```groovy
generator photon {
  provider = "photonjs"
}
//...
```
and generates a Photon.js client and a `photon` directory inside `node_modules/@prisma`:

```
node_modules
└── @prisma
    └── photon
        └── runtime
            ├── index.d.ts
            └── index.js
```

This is the default path but can be [customized](https://github.com/prisma/prisma2/blob/master/docs/photon/codegen-and-node-setup.md). It is best not to change the files in the generated directory because it will get overwritten every time `prisma2 generate` is invoked.

Now you can import Photon.js in your project.  Create a main application file, `index.ts`, inside the `src` directory and import the `Photon` constructor: 

```ts
import { Photon } from '@prisma/photon'
```

## 4. Setting up a connection

In TypeORM, there are several ways to create a connection. The most common way is to use `createConnection` and `createConnections` functions: 

[index.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/index.ts)
```ts
import createConnection from "typeorm"

const connection = createConnection()

```
### Migrating the connection

To achieve this in your Photon.js project, in your `index.ts` file, import `Photon` and create a new instance of it like this:

```ts
import { Photon } from '@prisma/photon'

const photon = new Photon()
```
Now you can start using the `photon` instance and interact with your database programmatically with the generated Photon API.

The `Photon` instance connects [lazily](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#managing-connections) when the first request is made to the API (`connect()` is called for you under the hood). 


## 5. Creating models

In TypeORM, models are called _entities_.  It is recommended to define one entity class per file (as "entity schemas" which you can import later). This is why, in the example project, there is a [Category.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/entity/Category.ts) file for the `Category` entity and a [Post.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/entity/Post.ts) file for the `Post` entity.  TypeORM allows you to use your classes as database models and provides a declarative way to define what part of your model will become part of your database table. `Entity` is a class that maps to a database table. You can create an entity by defining a new class and mark it with `@Entity()`.  Each entity must have at least one primary column (`@PrimaryGeneratedColumn()`). Each entity class property you marked with `@Column` will be mapped to a database table column.  

In our sample TypeORM project:

[Category.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/entity/Category.ts)
```ts
import {Entity} from "typeorm"

@Entity()
export class Category {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
```

[Post.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/entity/Post.ts)
```ts
import {Entity} from "typeorm"

@Entity()
export class Post {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column("text")
  text: string;

  @ManyToMany(type => Category, {
    cascade: true
  })
  @JoinTable()
    categories: Category[];
}
```

In your Photon.js project, the models above were auto-generated from the introspection process. These model definitions are located in the Prisma schema.  Models represent the entities of your application domain, define the underlying database schema, and are the foundation for the auto-generated CRUD operations of the database client.

Take a look at your generated Prisma schema file ([example here](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma)).  The `Category` and `Post` entities from the TypeORM project are translated to `Category` and `Post` models:

```groovy
model Category {
  id                     Int                      @id
  name                   String
  postCategoriesCategory PostCategoriesCategory[]

  @@map("category")
}

model Post {
  id                     Int                      @id
  postCategoriesCategory PostCategoriesCategory[]
  text                   String
  title                  String

  @@map("post")
}

model PostCategoriesCategory {
  id         Int           @id
  categoryId Category
  postId     Post

  @@map("post_categories_category")
}
```

`Category` and `Post` are mapped to database tables. The fields are mapped to columns of the tables. Note that there is a many-to-many relation between `Category` and `Post` via the `PostCategoriesCategory` relation table and the `@id` directive indicates that this field is used as the _primary key_. 

If you change your datamodel, you can regenerate Photon.js and all typings will be updated.


## 6. Querying the database

With TypeORM there are several ways to query the database. In this example, [`Repository`](https://typeorm.io/#/working-with-repository) is used as a collection of all operations for a concrete entity (in this case, `Post`).    

In the sample project, you first access a `Post` repository via the `getRepository` method so that you can perform operations against it.  Then, in your Express application route for the `/posts` endpoint, use the `Post` repository's `find()` method to fetch all the posts from the database and send the result back. 

[index.ts](https://github.com/infoverload/migration_typeorm_photon/blob/typeorm/src/index.ts)
```ts
import "reflect-metadata"
import {createConnection} from "typeorm"
import {Request, Response} from "express"
import * as express from "express"
import * as bodyParser from "body-parser"
import {Post} from "./entity/Post"

// connection settings are in the "ormconfig.json" file
createConnection().then(connection => {

    const postRepository = connection.getRepository(Post)

    app.get("/posts", async function(req: Request, res: Response) {
        const posts = await postRepository.find()
        res.send(posts)
    });
    //...

    // start Express server
    app.listen(3000)
    console.log("Express application is up and running on port 3000")

}).catch(error => console.log("Error: ", error));
```


Your generated Photon API will expose the following [CRUD operations](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#crud) for the `Category` and `Post` models:
- `findOne`
- `findMany`
- `create`
- `update`
- `updateMany`
- `upsert`
- `delete`
- `deleteMany`

### Migrating the `/posts` route (`GET`)

So to implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/posts` endpoint for the `app.get` route, fetch all the posts from the database with [`findMany`](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#findMany), a method exposed for the `Post` model with the generated Photon API.  Then send the results back.  Note that the API calls are asynchronous so we can `await` the results of the operation.

```ts
import * as express from 'express'
import * as bodyParser from 'body-parser'
import { Photon } from '@prisma/photon'

const app = express()
app.use(bodyParser.json())

const photon = new Photon()

app.get('/posts', async (req, res) => {
    const posts = await photon.posts.findMany()
    res.send(posts)
})

//...

app.listen(3000, () =>
  console.log('Server is running on http://localhost:3000'),
)
```

Let's migrate another route. In the TypeORM project, this is the endpoint to retrieve a post by it's ID:

```ts
//...
app.get("/posts/:id", async function(req: Request, res: Response) {

    const post = await postRepository.findOne(req.params.id)

    if (!post) {
        res.status(404)
        res.end()
        return
    }
    return res.send(post)
})
//...
```
All repository `find` methods accept special options you can use to query data you need.  

### Migrating the `/posts/:id` route (`GET`)

So to implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/posts/:id` endpoint, save the `id` of the post we want from the request parameter, use the `findOne` method generated for the `post` model to fetch a post identified by a unique value and specify the unique field to be selected with the `where` option.  Then send the results back.  

```ts
//...
app.get(`/posts/:id`, async (req, res) => {
    const { id } = req.params
    const post = await photon.posts.findOne({ 
        where: { 
          id: Number(id),
        },
    })
    res.json(post)
})
//...
```

Let's migrate the route that handles POST requests.  In the TypeORM project, this is the endpoint to create and save a new post:

```ts
//...
app.post("/posts", async function(req: Request, res: Response) {
    const newPost = await postRepository.create(req.body)
    await postRepository.save(newPost)
    return res.send(newPost)
})
//...
```
### Migrating the `/posts` route (`POST`)

To implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/posts` endpoint for the `app.post` route, save the user input from the request body, use the `create` method generated for the `post` model to create a new record with the requested data, and return the newly created object.  

```ts
//...
app.post(`/posts`, async (req, res) => {
  const { text, title } = req.body
  const post = await photon.posts.create({
    data: {
        text,
        title,
    },
  })
  res.json(post)
})
//...
```

Let's migrate one last route.  In the TypeORM project, this is the endpoint to delete a post by it's id: 

```ts
//...
app.delete("/posts/:id", async function(req: Request, res: Response) {
    const result = await postRepository.delete(req.params.id)
    return res.send(result)
})
//...
```
### Migrating the `/posts/:id` route (`DELETE`)

To implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/posts/:id` endpoint for the `app.delete` route, save the `id` of the post we want to delete from the request body, use the `delete` method generated for the `post` model to delete an existing record `where` the `id` matches the requested input, and return the corresponding object.  

```ts
//...
app.delete(`/posts/:id`, async (req, res) => {
  const { id } = req.params
  const post = await photon.posts.delete({ 
    where: { 
        id: Number(id),
    },
  })
  res.json(post)
})
//...
```

Now you can migrate the other routes following this pattern.  If you get stuck, refer back to the `master` branch of the project. 


## 7. Setting up your TypeScript project

After you have implemented the routes in your main application file, it's time to set up your TypeScript project. 

### 7.1. Initialize your project and install dependencies

In your project root, initialize a new npm project: 

```
npm init -y
```

Install the `typescript` and `ts-node` packages locally: 

```
npm install --save-dev typescript ts-node
```


### 7.2. Add TypeScript configuration

Create a [tsconfig.json](https://github.com/infoverload/migration_typeorm_photon/blob/master/tsconfig.json) file in your project root and add:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "outDir": "dist",
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "lib": ["esnext", "dom"]
  }
}
```

### 7.3. Add a start script to `package.json`

In your [package.json](https://github.com/infoverload/migration_typeorm_photon/blob/master/package.json) file, add a start script:

```diff
//...
"scripts": {
+ "start": "ts-node src/index.ts"
  //...
}
//...
```

### 7.4 Run the project

With everything in place, you can run the project!

```
npm start
```


## 8. Other considerations

The sample project that was used demonstrated the fundamental capabilities of both TypeORM and Photon.js but there are more things to consider when migrating, such as transactions and working with relations, which may be covered in a future tutorial.  The main thing to note is that while Photon.js is comparable to an ORM, it should rather be considered as an auto-generated database client.    


## Next steps

- Learn more about [Photon's relation API](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#relations)
- Engage with our [community](https://www.prisma.io/community/)!
- The Prisma Framework is not production-ready [yet](https://github.com/prisma/prisma2/blob/master/docs/limitations.md), so we value your [feedback](https://github.com/prisma/prisma2/blob/master/docs/prisma2-feedback.md)!

If you run into problems with this tutorial or spot any mistakes, feel free to make a pull request. 
