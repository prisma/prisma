# Prisma 2

This repository is used as a central point to collect information and issues around Prisma 2 while it's in Preview. It also contains the [documentation](./docs) and the [code of the Prisma 2 CLI](./cli).

💡 Prisma 2 is currently in Preview! [Limitations](./docs/limitations.md) include missing features and limited performance issues. You can track the progress of Prisma 2 on [**`isprisma2ready.com`**](https://www.isprisma2ready.com).

To get started, you can explore a number of ready-to-run [**examples**](https://github.com/prisma/prisma-examples/tree/prisma2) or follow the [**"Getting Started"-guide**](./docs/getting-started/README.md) to use Prisma with your existing database. The example projects include use cases such as building GraphQL, REST or gRPC APIs (with Node.js or TypeScript) using Prisma 2.

## What is Prisma 2?

Prisma 2 is a database framework that consists of these tools:

- [**Prisma Client JS**](https://github.com/prisma/prisma-client-js): Type-safe and auto-generated database client ("ORM replacement")
- [**Prisma Migrate**](https://github.com/prisma/migrate): Declarative data modeling and migrations
- [**Studio**](https://github.com/prisma/studio): Admin UI to support various database workflows

While each tool can be used standalone (in both [_greenfield_ and _brownfield_ projects](https://en.wikipedia.org/wiki/Brownfield_(software_development))), they integrate nicely through common components like the [**Prisma schema**](./docs/prisma-schema-file.md) or the [Prisma 2 CLI](./docs/prisma2-cli.md).

## Getting started

Follow the [**"Getting Started"-guide**](./docs/getting-started/README.md) to start using Prisma.

## Contents

- [Getting started](./docs/getting-started/README.md)
- [Tutorial](./docs/tutorial.md)
- [Prisma schema file](./docs/prisma-schema-file.md)
- [Data sources](./docs/data-sources.md)
- [Data modeling](./docs/data-modeling.md)
- [Relations](./docs/relations.md)
- [Prisma 2 CLI](./docs/prisma2-cli.md)
- [Introspection](./docs/introspection.md)
- [Limitations](./docs/limitations.md)
- [Core](./docs/core)
- Prisma Client JS
  - [API](./docs/prisma-client-js/api.md)
  - [Code generation & Node.js setup](./docs/prisma-client-js/codegen-and-node-setup.md)
  - [Deployment](./docs/prisma-client-js/deployment.md)
- [Prisma Migrate (Experimental)](./docs/prisma-migrate)
- [Importing and exporting data](./docs/import-and-export-data)
- [Supported databases](./docs/supported-databases.md)
- [Telemetry](./docs/telemetry.md)
- [How to provide feedback for Prisma 2?](./docs/prisma2-feedback.md)
- [Release process](./docs/releases.md)
- Upgrade guides
  - [Upgrading from Prisma 1](./docs/upgrade-guides/upgrading-from-prisma-1.md)
  - [Upgrading to `2.0.0-preview019`](./docs/upgrade-guides/upgrading-to-preview019.md)
- [FAQ](./docs/faq.md)
- [Glossary](./docs/glossary.md)

## Contributing

Read more about how to contribute to Prisma 2 [here](https://github.com/prisma/prisma2/blob/master/CONTRIBUTING.md)

## Build Status

[![Build status](https://badge.buildkite.com/590e1981074b70961362481ad8319a831b44a38c5d468d6408.svg)](https://buildkite.com/prisma/prisma2-test)

 [![Actions Status](https://github.com/prisma/prisma2-e2e-tests/workflows/test/badge.svg)](https://github.com/prisma/prisma2-e2e-tests/actions)
