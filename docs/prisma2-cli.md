# Prisma 2 CLI

## Installation

The Prisma 2 CLI currently requires [Node 8](https://nodejs.org/en/download/releases/) (or higher).

### npm

```
npm install -g prisma2
```

### Yarn

```
yarn global add prisma2
```

## Using a HTTP proxy for the CLI

The Prisma 2 CLI supports [custom HTTP proxies](https://github.com/prisma/prisma2/issues/506). This is particularly relevant when being behind a corporate firewall.

To activate the proxy, provide the environment variables `HTTP_PROXY` and/or `HTTPS_PROXY`. The behavior is very similar to how the [`npm` CLI handles this](https://docs.npmjs.com/misc/config#https-proxy).

The following environment variables can be provided:

- `HTTP_PROXY` or `http_proxy`: Proxy URL for http traffic, for example `http://localhost:8080`
- `HTTPS_PROXY` or `https_proxy`: Proxy URL for https traffic, for example `https://localhost:8080`

> To get a local proxy, you can also use the [`proxy`](https://www.npmjs.com/package/proxy) module:


## Commands

### Setup and development

#### `prisma2 init`

Sets up Prisma (i.e., Photon and/or Lift) via an interactive wizard. You can specify your database connection and/or create a new database to work with. For a list with currently supported databases, see the [this page](./supported-databases.md). The wizard also allows you to derive a Prisma schema file from your existing database.

#### `prisma2 dev`

Starts Prisma [development mode](./development-mode.md). This starts a server that lets you interact with your database and defined models. Note that Prisma Studio relies on your Prisma schema file to provide a fully featured user-interface with CRUD (create / read / update / delete) functionality.

#### `prisma2 generate`

Invokes all generators defined in the Prisma schema file. For example, this creates the Photon client to interact with the underlying database. Read more about Photon and its capabilities [here](./photon/use-only-photon.md).

#### `prisma2 introspect`

Introspects the database and generates a data model from it. Basically, it analyzes your (already existing) database and automatically creates the Prisma schema file for you. This is useful, if you already have an existing application and want to start using the Prisma framework. Note that this command synchronizes your Prisma schema file according to your database structure; typically if you're not using Lift to migrate your database.

### Lift (migrations)

#### `prisma2 lift save`

Creates a new migration based on changes on your data model. In this context it automatically documents all changes (i.e., a `git diff`). All changes are only applied **locally** and are **not** applied to the database.

#### `prisma2 lift up`

Runs all migrations that have not been applied to the database yet. This command effectively "replays" all local changes to the database.

#### `prisma2 lift down`

This command reverts a database migration. In turn, it creates a "compensation" migration that undoes previous changes.
