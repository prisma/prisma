# FAQ

- Photon
  - [Can I still access my database directly (e.g. using raw SQL)?](#can-i-still-access-my-database-directly-eg-using-raw-sql)
  - [Is Photon an ORM?](#is-photon-an-orm)
  - [Will Photon support more databases (and other data sources) in the future?](#will-photon-support-more-databases-and-other-data-sources-in-the-future)
  - [How can I see the generated queries that Photon sends to my database?](#how-can-i-see-the-generated-queries-that-photon-sends-to-my-database)
  - [How do schema migrations work with Photon?](#how-do-schema-migrations-work-with-photon)
  - [Is Photon production-ready? Should I start using it?](#is-photon-production-ready-should-i-start-using-it)
  - [Does Photon support GraphQL schema delegation and GraphQL binding?](#does-photon-support-graphql-schema-delegation-and-graphql-binding)
- Lift
  - [Am I locked-in when using Lift? Is it easy to migrate off it?](#am-i-locked-in-when-using-lift-is-it-easy-to-migrate-off-it)
  - [How do I see details about how Lift migrates my database schema?](#how-do-i-see-details-about-how-lift-migrates-my-database-schema)
  - [How can I extend a migration with custom functionality, e.g. running a script?](#how-can-i-extend-a-migration-with-custom-functionality-eg-running-a-script)
  - [Is Lift production-ready? Should I start using it?](#is-lift-production-ready-should-i-start-using-it)
- Other
  - [Since Prisma 2 is released, will Prisma 1 still be maintained?](#since-prisma-2-is-released-will-prisma-1-still-be-maintained)

## Photon

### Can I still access my database directly (e.g. using raw SQL)?

While it's currently not possible to use Photon to directly access your database, this feature has a priority on our list and is one of the first things we are working on during the Preview period. You can track the progress of this feature [here](https://github.com/prisma/photonjs/issues/10). 

In the meanwhile, you can use Photon alongside other lightweight query builders such as [knex](https://www.github.com/tgriesser/knex).

### Is Photon an ORM?

ORMs are typically object-oriented mapping layers that map classes to tables. A record is represented as an object that not only carries data but also implements various behaviours for storage, retrieval,
serialization and deserialization of its own data, sometimes it also implements business/domain logic.
Photon acts more as a _query builder_ returning plain objects with a focus on structural typing rather than rich object behavior.

### Will Photon support more databases (and other data sources) in the future?

Yes. Photon is based on Prisma's query engine that can connect to any data source that provides a proper connector implementation. There will be built-in connectors such as the current ones for [PostgreSQL](./core/connectors/postgresql.md), [MySQL](./core/connectors/mysql.md) and [SQLite](./core/connectors/sqlite.md). 

However, it's also possible to build your own connectors, more documentation on that topic will follow soon.

### How can I see the generated queries that Photon sends to my database?

There will be rich query analytics for Photon soon. For now you can set the `debug` option to `true` when instanting your `Photon` instance. Learn more in the [docs](./photon/api.md#debugging).

### How do schema migrations work with Photon?

Photon is not opinionated on how exactly you migrate your database schema. You can keep your existing migration system and simply re-introspect your database schema after each migration to update Photon. Learn more in the [docs](./photon/use-only-photon.md). You can also always use [Lift](https://lift.prisma.io) to perform your migrations based on Prisma's declarative [data model definition](./data-modeling.md).

### Is Photon production-ready? Should I start using it?

Photon is not yet production-ready, it has a number of severe [limitations](./limitations.md) that don't make it suitable for production uses and heavy loads. You can track the progress of the release process on [isprisma2ready.com](https://www.isprisma2ready.com). While it shouldn't be used for critical applications yet, Photon is definitely in a usable state. You can help us accelerate the release process by using it and [sharing your feedback](./prisma2-feedback.md) with us.

### Does Photon support GraphQL schema delegation and GraphQL binding?

GraphQL [schema delegation](https://www.prisma.io/blog/graphql-schema-stitching-explained-schema-delegation-4c6caf468405/) connects two GraphQL schemas by passing the [`info`](https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a/) object from a resolver of the first GraphQL schema to a resolver of the second GraphQL schema. Schema delegation also is the foundation for [GraphQL binding](https://github.com/graphql-binding/graphql-binding).

Prisma 1 officially supports both schema delegation and GraphQL binding as it exposes a GraphQL CRUD API through the [Prisma server](https://www.prisma.io/docs/prisma-server/). This API can be used to as foundation for an application-layer GraphQL API created with GraphQL binding. 

With Prisma 2, Prisma's query engine doesn't expose a [spec](https://graphql.github.io/graphql-spec/June2018/)-compliant GraphQL endpoint any more, so usage of schema delegation and GraphQL binding with Prisma 2 is not officially supported. To build GraphQL servers with Prisma 2, be sure to check out [GraphQL Nexus](https://nexus.js.org/) and its [`nexus-prisma`](https://nexus.js.org/docs/database-access-with-prisma-v2) integration. GraphQL Nexus provides a code-first and type-safe way to build GraphQL servers in a scalable way. 

## Lift

### Am I locked-in when using Lift? Is it easy to migrate off it?

There's absolutely no lock-in with Lift. To stop using Lift, you can simply delete your [Prisma schema file](./prisma-schema-file.md), all existing migration folders on your file system and the `migrations` table in your database/schema.

### How do I see details about how Lift migrates my database schema?

Each migration is represented via its own directory on your file system. The name of each directory contains a timestamp so that the order of all migrations in the project history can be maintained. Each of these migration directories contains detailed information about the respective migration, for example which steps are executed (and in what order) as well as a human-friendly markdown file that summarizes the most important information about the migration, such as the source and the target [data model definition](./data-modeling.md#data-model-definition) of the migration. This information can also be found in the        `migrations` table in your database/schema. 

Also, the `lift` CLI constantly prints the migration statements and more information when you're running its commands.

### How can I extend a migration with custom functionality, e.g. running a script?

Every migration can be extended with before/after hooks. You can simply put executable scripts into a migration folder that are named `before` and/or `after` (or `before.{sh,js}` and/or `after.{sh,js}`) and they will be picked up automatically by Lift when you're running `prisma2 lift up`.

### Is Lift production-ready? Should I start using it?

Lift is not yet production-ready, it has a number of severe [limitations](./limitations.md) that don't make it suitable for production uses. You can track the progress of the release process on [isprisma2ready.com](https://www.isprisma2ready.com). 

While it shouldn't be used for critical applications yet, Lift is definitely in a usable state. You can help us accelerate the release process by using it and [sharing your feedback](./prisma2-feedback.md) with us.

## Other

### Since Prisma 2 is released, will Prisma 1 still be maintained?

Yes, Prisma 1 will continue to be maintained. However, most Prisma engineering resources will go into the development of [Prisma 2](https://github.com/prisma/prisma2) (i.e. [Photon](https://photonjs.prisma.io/) and [Lift](https://lift.prisma.io/)). 

There will be no new features developed for Prisma 1.

### Where can I get more information about the plans for Prisma 2?

Check out the [`specs`]() repo which contains the technica specifications for future Prisma 2 features. Get involved by [creating issues](https://github.com/prisma/prisma2/issues) and [sharing feedback](./prisma2-feedback)!

