# Prisma 2 CLI

## Installation

Prisma 2 CLI currently requires [Node 10](https://nodejs.org/en/download/releases/) (or higher).

### Local installation (recommended)

The Prisma 2 CLI is typically installed as a **development dependency**, that's why the `--save-dev` (npm) and `--dev` (Yarn) options are used in the commands below.

#### npm

Install with npm:

```
npm install prisma2 --save-dev
```

This should add `prisma2` to the `devDependencies` in your `package.json`. You can then invoke the locally installed `prisma2` CLI by prefixing it with [`npx`](https://github.com/npm/npx#readme):

```
npx prisma2
```

Here's an example for invoking the `generate` command:

```
npx prisma2 generate
```


#### Yarn

Install with Yarn:

```
yarn add prisma2 --dev
```

This should add `prisma2` to the `devDependencies` in your `package.json`. You can then invoke the locally installed `prisma2` CLI by prefixing it with `yarn`:

```
yarn prisma2
```

Here's an example for invoking the `generate` command:

```
yarn prisma2 generate
```

### Global installation

While it is recommended to [locally install](#local-installation-recommended) the `prisma2` CLI, you can also install it globally on your machine. 

> **Warning**: If you have several Prisma projects on your machine, a global installation can lead to version conflicts between these projects.

#### npm

Install with npm:

```
npm install -g prisma2
```

You can then invoke the globally installed `prisma2` CLI like so:

```
prisma2
```

Here's an example for invoking the `generate` command:

```
prisma2 generate
```


#### Yarn

Install with Yarn:

```
yarn global add prisma2
```

You can then invoke the globally installed `prisma2` CLI like so:

```
prisma2
```

Here's an example for invoking the `generate` command:

```
prisma2 generate
```

### The `postinstall` hook

When installing Prisma 2 CLI, a [`postinstall`](https://github.com/prisma/prisma2/blob/master/cli/sdk/package.json#L13) hook is being executed. It downloads Prisma 2's query and migration [engine binaries](https://github.com/prisma/prisma-engine). The query engine contains the [Prisma schema](./prisma-schema-file.md) parser which is used by the `prisma2 init` and the `prism2 generate` commands. The migration engine is used by all `prisma2 migrate` commands.

## Using a HTTP proxy for the CLI

Prisma 2 CLI supports [custom HTTP proxies](https://github.com/prisma/prisma2/issues/506). This is particularly relevant when being behind a corporate firewall.

To activate the proxy, provide the environment variables `HTTP_PROXY` and/or `HTTPS_PROXY`. The behavior is very similar to how the [`npm` CLI handles this](https://docs.npmjs.com/misc/config#https-proxy).

The following environment variables can be provided:

- `HTTP_PROXY` or `http_proxy`: Proxy URL for http traffic, for example `http://localhost:8080`
- `HTTPS_PROXY` or `https_proxy`: Proxy URL for https traffic, for example `https://localhost:8080`

> To get a local proxy, you can also use the [`proxy`](https://www.npmjs.com/package/proxy) module:

## Commands

### Setup and development

#### `prisma2 init`

Sets up a `prisma/schema.prisma` file in the current directory. See [https://pris.ly/d/getting-started](https://pris.ly/d/getting-started).

#### `prisma2 generate`

Invokes all generators defined in the Prisma schema file. For example, this creates the Prisma Client JS to interact with the underlying database. Read more about Prisma Client JS and its capabilities [here](./prisma-client-js/use-only-prisma-client-js.md).

#### `prisma2 introspect`

Introspects the database and generates a data model from it. Basically, it analyzes your (already existing) database and automatically creates the Prisma schema file for you. This is useful, if you already have an existing application and want to start using Prisma 2. Note that this command synchronizes your Prisma schema file according to your database structure; typically if you're not using Prisma Migrate to migrate your database.

### Migrations

> **Warning**: Prisma Migrate is currently in an **experimental** state. When using any of the the `prisma2 migrate` commands, you need to explicitly opt-in to that functionality via an `--experimental` flag, e.g. `prisma2 migrate save --experimental`.

#### `prisma2 migrate save`

Creates a new migration based on changes on your data model. In this context, it automatically documents all changes (i.e., a `git diff`). All changes are only applied **locally** and are **not** applied to the database. However, the migration is already written into the `_Migration` table of your database (which stores your project's migration history).

#### `prisma2 migrate up`

Runs all migrations that have not been applied to the database yet. This command effectively "replays" all local changes to the database.

#### `prisma2 migrate down`

This command reverts a database migration. In turn, it creates a "compensation" migration that undoes previous changes.
