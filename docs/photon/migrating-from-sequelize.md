# Tutorial: Migrating from Sequelize to Photon.js

[Sequelize](https://sequelize.org/) and [Photon.js](https://photonjs.prisma.io/) both act as abstraction layers between your application and your database, but each works differently under the hood and provides different types of abstractions.   

In this tutorial, we will compare both approaches for working with databases and walk through how to migrate from a Sequelize project to a Photon.js one.

> **Note**: If you encounter any problems with this tutorial or any parts of Prisma 2, this is how you can get help: **create an issue on [GitHub](https://github.com/prisma/prisma2/issues)** or join the [`#prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on [Slack](https://slack.prisma.io/) to share your feedback directly. We also have a community forum on [Spectrum](https://spectrum.chat/prisma).

## Goals

This tutorial will show you how to achieve the following in your migration process:
1. [Obtaining the Prisma schema from your database](#1-Introspecting-the-existing-database-schema-from-the-Sequelize-project)
2. [Setting up your TypeScript project](#2-Setting-up-your-TypeScript-project)
3. [Specifying the data source](#3-Specifying-the-data-source)
4. [Installing and importing the library](#4-Installing-and-importing-the-library)
5. [Setting up a connection](#5-Setting-up-a-connection)
6. [Modelling data](#6-Creating-models)
7. [Querying the database](#7-Querying-the-database)
8. [Running the project](#8.-Running-the-project)
9. [Other migration considerations](#9-Other-considerations)

## Prerequisites

This tutorial assumes that you have some basic familiarity with:

- TypeScript
- Node.js
- PostgreSQL

You will use **TypeScript** with a **PostgreSQL** database in this tutorial. You can set up your PostgreSQL database [locally](https://www.robinwieruch.de/postgres-sql-macos-setup) or use a hosting provider such as [Heroku](https://elements.heroku.com/addons) or [Digital Ocean](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-postgresql-on-ubuntu-18-04).

- Make sure that your database server is [running](https://tableplus.com/blog/2018/10/how-to-start-stop-restart-postgresql-server.html)
- Know your database server credentials
- Have a database created for the tutorial 

You will be migrating a REST API built with the [Express](https://expressjs.com/) framework.  The example project can be found in this [repository](https://github.com/infoverload/migration_sequelize_photon). 

Clone the repository and navigate to it:

```sh
git clone https://github.com/infoverload/migration_sequelize_photon
cd migration_sequelize_photon
```

The Sequelize version of the project can be found in the [`sequelize`](https://github.com/infoverload/migration_sequelize_photon/tree/sequelize) branch.  To switch to the branch, type:

```sh
git checkout sequelize
```

The finished Photon.js version of the project is in the [`master`](https://github.com/infoverload/migration_sequelize_photon/tree/master) branch. To switch to this branch, type:

```sh
git checkout master
```

## 1. Introspecting the existing database schema from the Sequelize project

Follow the instructions in the [README file](https://github.com/infoverload/migration_sequelize_photon/blob/sequelize/README.md) in the [`sequelize`](https://github.com/infoverload/migration_sequelize_photon/tree/sequelize) branch and get the project running against your PostgreSQL database. This sets up your database and defines the schema as defined in the TypeORM [entities](https://github.com/infoverload/migration_typeorm_photon/tree/typeorm/src/entity) of the project.  

Make sure that you have the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma2-cli.md) installed. The Prisma 2 CLI is available as the [`prisma2`](https://www.npmjs.com/package/prisma2) package on npm. You can install it as a global package on your machine by typing the following command in your terminal:

```sh
npm install -g prisma2
```

Prisma lets you [introspect](https://github.com/prisma/prisma2/blob/master/docs/introspection.md) your database to derive a data model definition from the current database schema. 

Now you are ready to introspect the database from the Sequelize project.  Navigate outside of the current project directory so you can start a new project. In your terminal, type the command:

```sh
prisma2 init photonjs_app
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
 SUCCESS  The photonjs_app directory was created!
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

model Task {
  id        Int      @id
  createdAt DateTime @default(now())
  title     String?
  updatedAt DateTime @updatedAt
  userId    User?

  @@map("tasks")
}

model User {
  id        Int      @id
  createdAt DateTime @default(now())
  tasks     Task[]
  updatedAt DateTime @updatedAt
  username  String   @unique

  @@map("users")
}
```
</Details>

Now in your terminal, type:

```sh
cd photonjs_app
prisma2 dev
```

This launches the [development mode](https://github.com/prisma/prisma2/blob/master/docs/development-mode.md). When in development mode, Prisma 2 runs a development server in the background that watches your [Prisma schema file](https://github.com/prisma/prisma2/blob/master/docs/prisma-schema-file.md). 

Whenever any changes are made in the schema file, the development server:
- (re)generates your data source clients (e.g. Photon.js)
- updates your database schema 
- creates a [Prisma Studio](https://github.com/prisma/studio) endpoint for you

Go to the endpoint (i.e. http://localhost:5555 ) and explore the generated Prisma schema visually in your browser. 

![](https://i.imgur.com/5vSzHaAr.png
)

## 2. Setting up your TypeScript project 

### 2.1. Initialize your project and install dependencies

In your project root, initialize a new npm project: 

```sh
npm init -y
```

Install the `typescript` and `ts-node` packages locally: 

```sh
npm install --save-dev typescript ts-node
```

Install the `express` and `body-parser` packages: 

```sh
npm install express body-parser
```

### 2.2. Add TypeScript configuration

Create a [tsconfig.json](https://github.com/infoverload/migration_sequelize_photon/blob/master/tsconfig.json) file in your project root and add:

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

### 2.3. Add a postinstall script to `package.json`

In your [package.json](https://github.com/infoverload/migration_sequelize_photon/blob/master/package.json) file, add a postinstall script:

```diff
//...
"scripts": {
+ "postinstall": "prisma2 generate"
}
//...
```

It is considered best practice to add Photon.js generation as a `postinstall` script because if you clone and install the project for the first time, the script will automatically generate the Photon.js database client and you can start running the code, reducing an extra step. 

## 3. Specifying the data source

To connect to the database with Sequelize, you must create a Sequelize instance. This can be done by either passing the connection parameters separately to the Sequelize constructor or by passing a single connection URI:

```ts
const Sequelize = require('sequelize');
const sequelize = new Sequelize('postgres://user:password@localhost:5432/database');
```

Sequelize is independent from specific dialects. This means that you'll have to install the respective connector library to your project yourself. For PostgreSQL, two libraries are needed, `pg` and `pg-hstore`.

In your Photon.js project, the data source and connection string was automatically generated when you ran through the `prisma2 init` process and is located in your [schema.prisma](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma) file:

```groovy
//...
datasource db {
  provider = "postgresql"
  url      = "postgresql://user:password@localhost:5432/database?schema=public"
}
//...
```

## 4. Installing and importing the library

Sequelize is installed as a [node module](https://www.npmjs.com/package/sequelize) with `npm install`, whereas Photon.js is generated by the Prisma CLI (which invokes a Photon.js generator) and provides a type-safe data access API for your data model.


### Using the Photon constructor

Make sure you are in your `photonjs_app` project directory. Then, in your terminal, run: 

```sh
prisma2 generate
```

This parses the Prisma schema file to generate the right data source client code (from reading the `generator` definition): 

[schema.prisma](https://github.com/infoverload/migration_typeorm_photon/blob/master/prisma/schema.prisma)
```groovy
generator photon {
  provider = "photonjs"
}
//...
```
and generates a Photon.js database client and a `photon` directory inside `node_modules/@generated`:

```
node_modules
└── @generated
    └── photon
        └── runtime
            ├── index.d.ts
            └── index.js
```

This is the default path but can be [customized](https://github.com/prisma/prisma2/blob/master/docs/photon/codegen-and-node-setup.md). It is best not to change the files in the generated directory because it will get overwritten every time `prisma2 generate` is invoked.

Now you can import Photon.js in your project.  Create a main application file, `index.ts`, inside the `src` directory and import the `Photon` constructor: 

```ts
import { Photon } from '@generated/photon'
```

## 5. Setting up a connection

In Sequelize, the database connection has been set up with the Sequelize constructor and a connection string. If you want Sequelize to automatically create tables (or modify them as needed) according to your model definition, you can use the `sync` method, as follows: 

```ts
//...
const eraseDatabaseOnSync = true;

sequelize.sync({ force: eraseDatabaseOnSync }).then(async () => {
  if (eraseDatabaseOnSync) {
    console.log(`Database & tables created!`);
    //...
  }
  //...
});
```

### Migrating the connection

To achieve this in your Photon.js project, in your `index.ts` file, import `Photon` and create a new instance of it like this:

```ts
import { Photon } from '@generated/photon'

const photon = new Photon()
```
Now you can start using the `photon` instance and interact with your database programmatically with the generated Photon API.

The `Photon` instance connects [lazily](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#managing-connections) when the first request is made to the API (`connect()` is called for you under the hood). 


## 6. Creating models

In Sequelize, a model is a class that extends `Sequelize.Model`. Models can be defined in two equivalent ways, with `Sequelize.Model.init(attributes, options)` or `sequelize.define`. To define mappings between a model and a table, use the `define` method. Each column must have a datatype.

[task.ts](https://github.com/infoverload/migration_sequelize_photon/blob/sequelize/src/models/task.ts)
```ts
const task = (sequelize, DataTypes) => {
  const Task = sequelize.define('task', {
    title: DataTypes.STRING,
  });
  Task.associate = models => {
    Task.belongsTo(models.User, {
      onDelete: "CASCADE",
      foreignKey: {
        allowNull: false
      }
    });
  };
  return Task;
};

export default task;
```

[user.ts](https://github.com/infoverload/migration_sequelize_photon/blob/sequelize/src/models/user.ts)
```ts
const user = (sequelize, DataTypes) => {
    const User = sequelize.define('user', {
      username: {
        type: DataTypes.STRING,
        unique: true,
      },
    });
    User.associate = models => {
      User.hasMany(models.Task, { onDelete: 'CASCADE' });
    };
    return User;
};

export default user;
```

The above code tells Sequelize to expect a table named `users` in the database with the field `username` and a table named `tasks` with the field `title`.

Sequelize also defines by default the fields `id` (primary key), `createdAt` and `updatedAt` to every model.

You can store your model definitions in separate files and use the `import` method to import them. The returned object is exactly the same as defined in the imported file's function.

[models/index.ts](https://github.com/infoverload/migration_sequelize_photon/blob/sequelize/src/models/index.ts)
```ts
const models = {
  User: sequelize.import('./user'),
  Task: sequelize.import('./task'),
};

Object.keys(models).forEach(key => {
  if ('associate' in models[key]) {
    models[key].associate(models);
  }
});

export default models;
```


In your Photon.js project, the models above were auto-generated from the introspection process. These model definitions are located in the Prisma schema.  Models represent the entities of your application domain, define the underlying database schema, and are the foundation for the auto-generated CRUD operations of the database client.

Take a look at your generated Prisma schema file ([example here](https://github.com/infoverload/migration_sequelize_photon/blob/master/prisma/schema.prisma)).  The `task` and `user` models from the Sequelize project are translated to `Task` and `User` models here:

```groovy
model Task {
  id        Int      @id
  createdAt DateTime @default(now())
  title     String?
  updatedAt DateTime @updatedAt
  userId    User?

  @@map("tasks")
}

model User {
  id        Int      @id
  createdAt DateTime @default(now())
  tasks     Task[]
  updatedAt DateTime @updatedAt
  username  String   @unique

  @@map("users")
}
```

`Task` and `User` are mapped to database tables. The fields are mapped to columns of the tables. 

Things to note:
- `@default` directive sets a default value
- `@id` and `@updatedAt` directives are managed by Prisma and read-only in the exposed Prisma API
- `@id` directive indicates that this field is used as the _primary key_
- `@unique` directive expresses a unique constraint which means that Prisma enforces that no two records will have the same values for that field

If you change your datamodel, you can regenerate Photon.js and all typings will be updated.

#### Note about the auto-generated Prisma schema
1. The field that points to the `User` model in the `Task` model is called `userId`. The naming occurred from the introspection process but is a bit misleading because it doesn't refer to the actual ID of the user. A solution may be to rename `userID` to `user`.  This can avoid naming confusions when using the Photon.js API.  
2. There is some mismatch between the `DateTime` types of Prisma and the ones of Postgres, so you may want to remove the `createdAt` and `updatedAt` fields for now. A [GitHub issue](https://github.com/prisma/prisma2/issues/552) has been created. 
3. The resulting schema after these changes may look like <Details><Summary>this.</Summary>

    ```groovy
    generator photon {
      provider = "photonjs"
    }

    datasource db {
      provider = "postgresql"
      url      = "postgresql://user:password@localhost:5432/database?schema=public"
    }

    model Task {
      id        Int      @id
      title     String?
      user      User?

      @@map("tasks")
    }

    model User {
      id        Int      @id
      tasks     Task[]
      username  String   @unique

      @@map("users")
    }
    ```
    </Details>


## 7. Querying the database   

### Migrating the `/users` route (`GET`)

Sequelize has a lot of options for querying your database, which you can learn more about [here](https://sequelize.org/master/manual/querying.html). 

In the sample project, you first import the `sequelize` constructor and the models you defined earlier.  Then, in your Express application route for the `/users` endpoint, use the `User` model's `findAll()` method to fetch all the users from the database and send the result back. 

[app.ts](https://github.com/infoverload/migration_sequelize_photon/blob/sequelize/src/app.ts)
```ts
import * as express from "express";
import * as bodyParser from "body-parser";
import models, { sequelize } from './models';

const app = express();
app.use(bodyParser.json());

// Define routes
app.get('/users', async (req, res) => {
    const users = await models.User.findAll();
    return res.send(users);
});
//...

```

Your generated Photon API will expose the following [CRUD operations](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#crud) for the `Task` and `User` models:
- `findOne`
- `findMany`
- `create`
- `update`
- `updateMany`
- `upsert`
- `delete`
- `deleteMany`

So to implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/users` endpoint for the `app.get` route, fetch all the posts from the database with [`findMany`](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#findMany), a method exposed for the `User` model with the generated Photon API.  Then send the results back.  Note that the API calls are asynchronous so we can `await` the results of the operation.

```ts
import * as express from 'express'
import * as bodyParser from 'body-parser'
import { Photon } from '@generated/photon'

const app = express()
app.use(bodyParser.json())

const photon = new Photon()

app.get('/users', async (req, res) => {
    const users = await photon.users.findMany()
    res.json(users)
})

//...

app.listen(3000, () =>
  console.log('Server is running on http://localhost:3000'),
)
```

### Migrating the `/users/:id` route (`GET`)

Let's migrate another route. In the Sequelize project, this is the endpoint to retrieve a user by it's id:

```ts
//...
app.get('/users/:userId', async (req, res) => {
    const user = await models.User.findByPk(
        req.params.userId,
    );
    return res.send(user);
});
//...
``` 

So to implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/users/:id` endpoint, save the `id` of the post we want from the request parameter, use the `findOne` method generated for the `user` model to fetch a post identified by a unique value and specify the unique field to be selected with the `where` option.  Then send the results back.  

```ts
//...
app.get(`/users/:id`, async (req, res) => {
    const { id } = req.params
    const user = await photon.users.findOne({ 
        where: { 
          id: Number(id),
        },
    })
    res.json(user)
})
//...
```

### Migrating the `/tasks` route (`POST`)

Let's migrate the route that handles POST requests.  In the Sequelize project, this is the endpoint to create and save a new task:

```ts
//...
app.post('/tasks', async (req, res) => {
    const task = await models.Task.create({
        title: req.body.title,
    });

    return res.send(task);
});
//...
```

To implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/tasks` endpoint for the `app.post` route, save the user input from the request body, use the `create` method generated for the `task` model to create a new record with the requested data, and return the newly created object.  

```ts
//...
app.post(`/tasks`, async (req, res) => {
  const { title } = req.body
  const post = await photon.tasks.create({
    data: {
        title,
    },
  })
  res.json(post)
})
//...
```

### Migrating the `/tasks/:id` route (`DELETE`)

Let's migrate one last route.  In the Sequelize project, this is the endpoint to delete a task by it's id: 

```ts
//...
app.delete('/tasks/:taskId', async (req, res) => {
    const result = await models.Task.destroy({
        where: { id: req.params.taskId },
    });

    return res.send(true);
});
//...
```

To implement the same route and endpoint in your Photon.js project, go to your `index.ts` file, and in the `/posts/:id` endpoint for the `app.delete` route, save the `id` of the post we want to delete from the request body, use the `delete` method generated for the `post` model to delete an existing record `where` the `id` matches the requested input, and return the corresponding object.  

```ts
//...
app.delete(`/tasks/:id`, async (req, res) => {
  const { id } = req.params
  const task = await photon.tasks.delete({ 
    where: { 
        id: Number(id),
    },
  })
  res.json(task)
})
//...
```

Now you can migrate the other routes following this pattern or create new routes.  If you get stuck, refer back to the `master` branch of the project. 


## 8. Running the project

In your [package.json](https://github.com/infoverload/migration_sequelize_photon/blob/master/package.json) file, add a start script:

```diff
//...
"scripts": {
+ "start": "ts-node src/index.ts"
  "postinstall": "prisma2 generate"
}
//...
```

When finished with your project, run it like this:

```sh
npm start
```

## 9. Other considerations

The sample project that was used demonstrated the fundamental capabilities of both Sequelize and Photon.js but there are more things to consider when migrating, such as transactions and working with relations, which may be covered in a future tutorial.  The main thing to note is that while Photon.js is comparable to an ORM, it should rather be considered as an auto-generated database client.    


## Next steps

- Learn more about [Photon's relation API](https://github.com/prisma/prisma2/blob/master/docs/photon/api.md#relations)
- Engage with our [community](https://www.prisma.io/community/)!
- Prisma 2 is not production-ready [yet](https://github.com/prisma/prisma2/blob/master/docs/limitations.md), so we value your [feedback](https://github.com/prisma/prisma2/blob/master/docs/prisma2-feedback.md)!

If you run into problems with this tutorial or spot any mistakes, feel free to make a pull request. 
