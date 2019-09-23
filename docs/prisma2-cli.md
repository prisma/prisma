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

> To get a simple local proxy, you can also use the [`proxy`](https://www.npmjs.com/package/proxy) module:


## Commands

### Setup and development

#### `prisma2 init`

Sets up Prisma (i.e. Photon and/or Lift) via an interactive wizard.

#### `prisma2 dev`

Starts Prisma [development mode](./development-mode.md).

#### `prisma2 generate`

Invokes the generators specified in the Prisma schema file.

#### `prisma2 introspect`

Introspects the database and generates a data model from it.

### Lift (migrations)

#### `prisma2 lift save`

Creates a new migration folder based on current data model changes. 

#### `prisma2 lift up`

Apply any migrations that have not been applied yet.

#### `prisma2 lift down`

Undo migrations.