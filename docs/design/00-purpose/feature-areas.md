# Feature areas

The code in `packages/` is organised in feature areas. The areas are the domains in [`architecture.config.json`](../../../architecture.config.json), and the sub-areas are each domain's layers there. The [Architecture Overview](../../Architecture%20Overview.md#domains-and-responsibilities) describes each domain.

Prisma 8 has no GitHub label for an area yet. The last column lists existing `topic:` labels on [prisma/orm](https://github.com/prisma/orm/labels) that fall in the area.

## Feature area

| Area | Description | Sub areas | Existing labels | Owner |
| --- | --- | --- | --- | --- |
| framework | Target-agnostic core: contract base types, plan model, runtime SPI, tooling and the CLI. Code in `packages/1-framework/` | foundation, core, authoring, tooling (which holds the CLI and the language server) | `topic: cli`, `topic: schema`, `topic: vscode extension` | |
| sql | The SQL family: contract shape and types, operation specs, emitter hook, lanes and runtime for any SQL dialect. Code in `packages/2-sql/` | core, authoring, tooling, lanes, runtime, family | `topic: raw`, `topic: migrate`, `topic: transaction` | |
| mongo | The Mongo family: contract, authoring, query AST and builders, wire transport and runtime. Code in `packages/2-mongo-family/` | foundation, authoring, tooling, query, query-builders, transport, runtime, family | `topic: mongodb` | |
| targets | Concrete targets, adapters and drivers for one database. Code in `packages/3-targets/` (Postgres) and `packages/3-mongo-target/` (MongoDB) | adapters, drivers | `topic: postgresql`, `topic: mongodb`, `topic: sqlite`, `topic: mysql`, `topic: mariadb` | |
| extensions | Extension packs and integrations built on the public SPI. Code in `packages/3-extensions/`: `arktype-json`, `middleware-cache`, `mongo`, `paradedb`, `pgvector`, `postgis`, `postgres`, `sql-orm-client` (the ORM client), `sqlite`, `supabase` | integrations, targets, adapters | `topic: client api`, `topic: extensibility`, `topic: postgis`, `topic: database-provider/supabase` | |

Owners are not recorded yet.
