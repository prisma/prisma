<p align="center"><a href="https://www.prisma.io"><img src="https://svgur.com/i/CXu.svg" alt="Prisma" height="66px"></a></p>

<p><h1 align="center">Photon JS</h1></p>
<p><h3 align="center">Type-safe ORM for TypeScript & Node.js (by <a href="">Prisma</a>)</h3></p>

<p align="center">
  <a href="#overview">Overview</a> • <a href="#quickstart">Quickstart</a> • <a href="#examples">Examples</a> • <a href="#supported-databases">Supported databases</a> 
</p>

<!--
<p align="center">
  <a href="https://circleci.com/gh/prisma/prisma"><img src="https://circleci.com/gh/prisma/prisma.svg?style=shield" alt="CircleCI"></a>
  <a href="https://slack.prisma.io"><img src="https://slack.prisma.io/badge.svg" alt="Slack"></a>
  <a href="https://spectrum.chat/prisma"><img src="https://withspectrum.github.io/badge/badge.svg" alt="Spectrum"></a>
</p>
-->

Photon JS is an **auto-generated database client library** that enables **type-safe** database access and **reduces boilerplate**. You can use it as an alternative to traditional ORMs such as Sequelize, TypeORM or Knex.js.

It is part of the [Prisma]() ecosystem. Prisma provides a family of tools to simplify database workflows for data access, declarative data modeling, schema migrations and visual data management. [Learn more.]()

<br />

<p align="center">
  <a href="https://codesandbox.io/s/github/prisma-csb/prisma-client-demo-ts"><img src="https://svgur.com/i/CXj.svg" alt="CodeSandbox"></a>
  <a href="https://www.prisma.io/docs/prisma-client/"><img src="https://svgur.com/i/CXT.svg" alt="Docs"></a>
</p>

<p align="center">
  Or try an online <a href="https://codesandbox.io/s/github/prisma-csb/graphql-example-ts">GraphQL API</a> or <a href="https://codesandbox.io/s/github/prisma-csb/rest-example-ts?initialpath=/feed">REST API</a> example in CodeSandbox instead.
</p>


## Overview

### Features

- Auto-generated database client
- Fully type-safe data access API (even for JavaScript)
- Powerful methods for filtering, sorting and (cursor) pagination
- [Data mapper](https://en.wikipedia.org/wiki/Data_mapper_pattern) ORM pattern
- Transactional nested writes and batching API
- Declarative data modelling and migrations
- Connection pooling
- Works with existing databases using schema introspection
- CLI to support all major workflows
- Integrates seamlessly in your npm projects (without `npm install`)

## How Photon JS works

#### 1. Configure database access

Specify the connection details for your database:

- `host`: The IP address or domain name of the machine where your database server is running.
- `port`: The port on which your database server is listening.
- `user` & `password`: Credentials for your database sever.

#### 2. Introspect your database

Introspect your database schema using the Prisma CLI. This generates a [datamodel]() which is the foundation for the generated Photon database client. The datamodel is a declarative and human-readable representation of your database schema.

#### 3. Generate Photon JS

Generate your Photon database client using the Prisma CLI. Photon is generated based on the datamodel and provides an API with the following features:

- CRUD
- Filter, sorting and (cursor) pagination
- Relations and transactions
- Raw database access

Photon JS gets generated into your `node_modules` folder. There's no need to install any additional dependencies or database drivers.

#### 4. Build an app

Similar to traditional ORMs, the Photon JS client can be used any of your Node.js or TypeScript applications. For example to implement REST, GraphQL or gRPC APIs.
