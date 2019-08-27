# Prisma 2

This repository is used as a central point to collect information and issues around [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/) while it's in Preview. It also contains the [documentation](./docs) and the [code of the Prisma 2 CLI](./cli).

💡 Prisma 2 is currently in Preview! [Limitations](./docs/limitations.md) include missing features, limited performance and stability issues. You can track the progress of Prisma 2 on [**`isprisma2ready.com`**](https://www.isprisma2ready.com).

## What is Prisma?

![](https://imgur.com/skyBm10.png)

Prisma is an application data framework consisting of these tools:

- [**Photon**](https://photonjs.prisma.io/): Type-safe and auto-generated database client ("ORM replacement")
- [**Lift**](https://lift.prisma.io/): Declarative data modeling and migrations
- [**Studio**](https://github.com/prisma/studio): Admin UI to support various database workflows

While each tool can be used standalone (in both [_greenfield_ and _brownfield_ projects](https://en.wikipedia.org/wiki/Brownfield_(software_development))), they integrate nicely through common components like the [**Prisma schema**](./docs/prisma-schema-file.md) or the [Prisma 2 CLI](./docs/prisma2-cli.md).

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
- [Prisma 2 CLI](./docs/prisma2-cli.md)
- [Development mode](./docs/development-mode.md)
- [Introspection](./docs/introspection.md)
- [Limitations](./docs/limitations.md)
- Core
  - Connectors
    - [MySQL](./docs/core/connectors/mysql.md)
    - [PostgreSQL](./docs/core/connectors/postgresql.md)
    - [SQLite](./docs/core/connectors/sqlite.md)
    - [MongoDB](./docs/core/connectors/mongo.md)
  - Generators
    - [Photon.js](./docs/core/generators/photonjs.md)
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
- [How to provide feedback for Prisma 2?](./docs/prisma2-feedback.md)
- [Release process](./docs/releases.md)
- [FAQ](./docs/faq.md)
- [Glossary](./docs/glossary.md)
