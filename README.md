# Prisma Framework 


This repository is used as a central point to collect information and issues around the **Prisma Framework** (formerly called [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/)) while it's in Preview. It also contains the [documentation](./docs) and the [code of the Prisma Framework CLI](./cli).

💡 The Prisma Framework is currently in Preview! [Limitations](./docs/limitations.md) include missing features and limited performance issues. You can track the progress of the Prisma Framework on [**`isprisma2ready.com`**](https://www.isprisma2ready.com).

To get started, you can explore a number of ready-to-run [examples](https://github.com/prisma/prisma-examples/tree/prisma2) or follow the holistic [tutorial](./docs/tutorial.md). The example projects include use cases such as building GraphQL, REST or gRPC APIs (with Node.js or TypeScript) using the Prisma Framework.

## What is the Prisma Framework?

![](https://i.imgur.com/FmaRakd.png)

The Prisma Framework (formerly called [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/)) is a database framework that consists of these tools:

- [**Photon**](https://photonjs.prisma.io/): Type-safe and auto-generated database client ("ORM replacement")
- [**Lift**](https://lift.prisma.io/): Declarative data modeling and migrations
- [**Studio**](https://github.com/prisma/studio): Admin UI to support various database workflows

While each tool can be used standalone (in both [_greenfield_ and _brownfield_ projects](https://en.wikipedia.org/wiki/Brownfield_(software_development))), they integrate nicely through common components like the [**Prisma schema**](./docs/prisma-schema-file.md) or the [Prisma Framework CLI](./docs/prisma2-cli.md).

## Getting started

The easiest way to get started with [Photon](https://github.com/prisma/photonjs) and/or [Lift](https://github.com/prisma/lift) is by using the `init` command of the `prisma2` CLI via [npx](https://github.com/npm/npx):

```
npx prisma2 init hello-prisma
```

Alternatively, you can install the `prisma2` CLI globally and run the `init` command then:

```
npm install -g prisma2
prisma2 init hello-prisma
```

The interactive prompt will ask you to provide database credentials for your database. If you don't have a database yet, select **SQLite** and let the CLI set up a database file for you.

## Contents

- [Getting started](./docs/getting-started.md)
- [Tutorial](./docs/tutorial.md)
- [Prisma schema file](./docs/prisma-schema-file.md)
- [Data sources](./docs/data-sources.md)
- [Data modeling](./docs/data-modeling.md)
- [Relations](./docs/relations.md)
- [Prisma Framework CLI](./docs/prisma2-cli.md)
- [Development mode](./docs/development-mode.md)
- [Introspection](./docs/introspection.md)
- [Limitations](./docs/limitations.md)
- [Core](./docs/core)
- Photon
  - [API](./docs/photon/api.md)
  - [Use only Photon](./docs/photon/use-only-photon.md)
  - [Code generation & Node.js setup](./docs/photon/codegen-and-node-setup.md)
  - [Deployment](./docs/photon/deployment.md)
- [Lift](./docs/lift)
- [Importing and exporting data](./docs/import-and-export-data)
- [Supported databases](./docs/supported-databases.md)
- [Telemetry](./docs/telemetry.md)
- [How to provide feedback for the Prisma Framework?](./docs/prisma2-feedback.md)
- [Release process](./docs/releases.md)
- [Upgrading from Prisma 1](./docs/upgrading-from-prisma-1.md)
- [FAQ](./docs/faq.md)
- [Glossary](./docs/glossary.md)

## Contributing

Read more about how to contribute to the Prisma Framework [here](https://github.com/prisma/prisma2/blob/master/CONTRIBUTING.md)

[![Build status](https://badge.buildkite.com/590e1981074b70961362481ad8319a831b44a38c5d468d6408.svg)](https://buildkite.com/prisma/prisma2-test)

