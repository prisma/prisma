# Prisma 2

This repository is used as a central point to collect information and issues around [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/) while it's in Preview. It also contains the [documentation](./docs).

> Prisma 2 is currently in Preview! [Limitations](./docs/limitations.md) include missing features, limited performance and stability issues.

## Getting started

The easiest way to get started with [Photon](https://github.com/prisma/photonjs) and/or [Lift](https://github.com/prisma/lift) is by installing the Prisma 2 CLI and running the interactive `init` command:

```
npm install -g prisma2
prisma2 init hello-prisma
```

The interactive prompt will ask you to provide database credentials for your database. If you don't have a database yet, select **SQLite** and let the CLI set up a database file for you.

Learn more about the `prisma2 init` flow [here](./docs/getting-started.md) or get started with a holistic [tutorial](./docs/tutorial.md).

## Contents

- [Getting started](./docs/getting-started.md)
- [Tutorial](./docs/tutorial.md)
- [Prisma ecosystem](./docs/prisma-ecosystem.md)
- [Prisma schema file](./docs/prisma-schema-file.md)
- [Data sources](./docs/data-sources.md)
- [Data modeling](./docs/data-modeling.md)
- [Relations](./docs/relations.md)
- [Prisma 2 CLI](./docs/prisma-2-cli.md)
- [Development mode](./docs/development-mode.md)
- [Introspection](./docs/introspection.md)
- [Limitations](./docs/limitations.md)
- Core
  - Connectors
    - [MySQL](./docs/core/connectors/mysql.md)
    - [PostgreSQL](./docs/core/connectors/postgres.md)
    - [SQLite](./docs/core/connectors/sqlite.md)
    - [MongoDB](./docs/core/connectors/mongo.md)
  - Generators
    - [Photon JS](./docs/core/generators/photon-js.md)
- Photon
  - [API](./docs/photon/api.md)
  - [Use only Photon](./docs/photon/use-only-photon.md)
  - [Code generation & Node.js setup](./docs/photon/codegen-and-node-setup.md)
  - [Deployment](./docs/photon/deployment.md)
- Lift
  - [Steps](./docs/lift/steps.md)
  - [Migration files](./docs/lift/migration-files.md)
  - [Use only Lift](./docs/lift/use-only-lift.md)
- [Supported databases](./docs/supported-databases.md)
- [Prisma 2 feedback](./docs/prisma2-feedback.md)
- [Glossary](./docs/glossary.md)

