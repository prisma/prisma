# Upgrade guide (Prisma 1 to Prisma Framework)

This upgrade guide describes how to migrate a project that's based on [Prisma 1](https://github.com/prisma/prisma) and uses the [Prisma client](https://www.prisma.io/docs/prisma-client/) to the Prisma Framework.

## Overview

On a high-level, the biggest differences between Prisma 1 and the Prisma Framework are the following:

- The Prisma Framework doesn't require hosting a database proxy server (i.e. the [Prisma server](https://www.prisma.io/docs/prisma-server/)).
- The Prisma Framework makes the features of Prisma 1 available as standalone components:
  - _Data modeling and migrations_ from Prisma 1 are now done with [Lift]()
  - _Database access using the Prisma client_ from Prisma 1 is done using [Photon.js]()
- The Prisma 1 datamodel and the `prisma.yml` have been merged into the [Prisma schema]() that's used in the Prisma Framework
- The Prisma Framework uses a its own modeling language instead of being based on GraphQL SDL

Based on these differences, the high-level steps to upgrade a project from using Prisma 1 are as follows:

1. Install the Prisma Framework CLI
1. Use the Prisma Framework CLI to [introspect]() your database schema and generate the corresponding Prisma schema
1. Adjust your application code, specifically replace the API calls from the Prisma client with those of Photon.js

Note that the steps will look somewhat different if you're ...: 

- **not using the Prisma client** (e.g. because you're using Prisma bindings).
- **building a GraphQL API using `nexus-prisma`**.

Both scenarios will be covered in other upgrade guides. In this guide, we'll take a look at migrating a REST API from Prisma 1 to the Prisma Framework based on this [Prisma 1 example](https://github.com/prisma/prisma-examples/tree/master/typescript/rest-express).

## 1. Install the Prisma Framework CLI 

The Prisma Framework CLI is currently available as the [`prisma2`](https://www.npmjs.com/package/prisma2) package on npm. You can install it on your machine as follows:

```
npm install -g prisma2
```

## 2. Introspect your database to generate a Prisma schema

The [Prisma schema]() is the foundation for any project that used the Prisma Framework. Think of the Prisma schema as the combination of the Prisma 1 data model and `prisma.yml` configuration file.

While many elements of the Prisma schema are similar to the data model, the syntax has changed quite a bit now. In general, there are three ways of obtaining a Prisma schema based on an existing Prisma 1 project:



