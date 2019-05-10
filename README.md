<p><h1 align="center">Lift</h1></p>
<p><h3 align="center">Database Schema Migrations (by <a href="">Prisma</a>)</h3></p>

<p align="center">
  <a href="#features">Features</a> • <a href="#how-it-works">How it works</a> • <a href="#supported-databases">Supported databases</a> 
</p>


Lift is a powerful database schema migration tool. It uses a **declarative data modelling** syntax to describe your database schema. Lift stores your entire **migration history** and easily lets you **revert and replay migrations**. When migrating your database with Lift, you can run provide **before- and after-hooks** to execute scripts, e.g. to populate the database with required values during a migration.

It is part of the [Prisma]() ecosystem. Prisma provides a family of tools to simplify database workflows for data access, declarative data modeling, schema migrations and visual data management. [Learn more.]()

## Features

- Declarative data modelling syntax
- Supports relational and document databases (more coming soon)
- Keeps a migration history
- Before- and after hooks to run scripts for complex migrations
- Simple defaults, optional complexity for advanced use cases
- Revert and replay migrations
- Works with existing databases using schema introspection
- CLI to support all major workflows

## How it works

### 1. Configure database access

Specify the connection details for your database:

- `host`: The IP address or domain name of the machine where your database server is running.
- `port`: The port on which your database server is listening.
- `user` & `password`: Credentials for your database sever.

![](https://i.imgur.com/UcN3ENI.png)

### 2. Introspect your database

Introspect your database schema using the Prisma CLI to generate your [datamodel](). The datamodel is a declarative and human-readable representation of your database schema.

![](https://i.imgur.com/XkRkwdE.png)

### 3. Adjust the datamodel

Instead of sending SQL migration statements to the database, you need to adjust the datamodel file to describe your desired database schema. You can express any schema migration you like using the new datamodel, this includes for example adding a new model, removing a model or updating the fields of a model. You can also add indexes or validation constraints in the datamodel.

![](https://i.imgur.com/ePrrlHP.png)

### 4. Migrate your database (apply datamodel changes)

Once you're happy with the changes, you can use the Prisma CLI to migrate your database (i.e. map the adjusted datamodel to your database). Lift's migration engine will generate the corresponding SQL statements and send them to the database for you.

![](https://i.imgur.com/L6a5Vqd.png)

## Supported databases

Photon JS can be used with the following databases:

- MySQL
- PostgreSQL
- MongoDB (_coming very soon_)

More databases that will be supported in the future are:

- MS SQL
- Oracle
- Neo4J
- FaunaDB
- ...