# FAQ

- Prisma Client JS
  - [Can I still access my database directly (e.g. using raw SQL)?](#can-i-still-access-my-database-directly-eg-using-raw-sql)
  - [Is Prisma Client JS an ORM?](#is-prisma-client-js-an-orm)
  - [Will Prisma Client JS support more databases (and other data sources) in the future?](#will-prisma-client-js-support-more-databases-and-other-data-sources-in-the-future)
  - [How can I see the generated queries that Prisma Client JS sends to my database?](#how-can-i-see-the-generated-queries-that-prisma-client-js-sends-to-my-database)
  - [How do schema migrations work with Prisma Client JS?](#how-do-schema-migrations-work-with-prisma-client-js)
  - [Is Prisma Client JS production-ready? Should I start using it?](#is-prisma-client-js-production-ready-should-i-start-using-it)
  - [Does Prisma Client JS support GraphQL schema delegation and GraphQL binding?](#does-prisma-client-js-support-graphql-schema-delegation-and-graphql-binding)
  - [How to handle connection pooling for Prisma Client JS in serverless environments?](#how-to-handle-connection-pooling-for-prisma-client-js-in-serverless-environments)
- Migrations
  - [Am I locked-in when using Prisma's migration tool? Is it easy to migrate off it?](#am-i-locked-in-when-using-prismas-migration-tool-is-it-easy-to-migrate-off-it)
  - [How do I see details about how Prisma migrates my database schema?](#how-do-i-see-details-about-how-prisma-migrates-my-database-schema)
  - [Is Prisma's migration tool production-ready? Should I start using it?](#is-prismas-migration-tool-production-ready-should-i-start-using-it)
- Other
  - [Since Prisma 2 is released, will Prisma 1 still be maintained?](#since-prisma-2-is-released-will-prisma-1-still-be-maintained)
  - [Where can I get more information about the plans for Prisma 2?](#where-can-i-get-more-information-about-the-plans-for-prisma-2)
  - [How much does Prisma 2 cost?](#how-much-does-prisma-2-cost)

## Prisma Client JS

### Can I still access my database directly (e.g. using raw SQL)?

While it's currently not possible to use Prisma Client JS to directly access your database, this feature has a priority on our list and is one of the first things we are working on during the Preview period. You can track the progress of this feature [here](https://github.com/prisma/prisma-client-js/issues/10). 

In the meanwhile, you can use Prisma Client JS alongside other lightweight query builders such as [knex](https://www.github.com/tgriesser/knex).

### Is Prisma Client JS an ORM?

ORMs are typically object-oriented mapping layers that map classes to tables. A record is represented as an object that not only carries data but also implements various behaviors for storage, retrieval,
serialization and deserialization of its own data, sometimes it also implements business/domain logic.
Prisma Client JS acts more as a _query builder_ returning plain objects with a focus on structural typing rather than rich object behavior.

### Will Prisma Client JS support more databases (and other data sources) in the future?

Yes. Prisma Client JS is based on Prisma's query engine that can connect to any data source that provides a proper connector implementation. There will be built-in connectors such as the current ones for [PostgreSQL](./core/connectors/postgresql.md), [MySQL](./core/connectors/mysql.md) and [SQLite](./core/connectors/sqlite.md). 

However, it's also possible to build your own connectors, more documentation on that topic will follow soon.

### How can I see the generated queries that Prisma Client JS sends to my database?

There will be rich query analytics for Prisma Client JS soon. For now you can set the `debug` option to `true` when instantiating your `PrismaClient` instance. Learn more in the [docs](./prisma-client-js/api.md#debugging).

### How do schema migrations work with Prisma Client JS?

Prisma Client JS is not opinionated on how exactly you migrate your database schema. You can keep your existing migration system and re-introspect your database schema after each migration to update Prisma Client JS. Learn more in the [docs](./prisma-client-js/use-only-prisma-client-js.md). You can also always use Prisma's `migrate` CLI to perform your migrations based on Prisma's declarative [data model definition](./data-modeling.md).

### Is Prisma Client JS production-ready? Should I start using it?

Prisma Client JS is not yet production-ready, it has a number of severe [limitations](./limitations.md) that don't make it suitable for production uses and heavy loads. You can track the progress of the release process on [isprisma2ready.com](https://www.isprisma2ready.com). While it shouldn't be used for critical applications yet, Prisma Client JS is definitely in a usable state. You can help us accelerate the release process by using it and [sharing your feedback](./prisma2-feedback.md) with us.

### Does Prisma Client JS support GraphQL schema delegation and GraphQL binding?

GraphQL [schema delegation](https://www.prisma.io/blog/graphql-schema-stitching-explained-schema-delegation-4c6caf468405/) connects two GraphQL schemas by passing the [`info`](https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a/) object from a resolver of the first GraphQL schema to a resolver of the second GraphQL schema. Schema delegation also is the foundation for [GraphQL binding](https://github.com/graphql-binding/graphql-binding).

Prisma 1 officially supports both schema delegation and GraphQL binding as it exposes a GraphQL CRUD API through the [Prisma server](https://www.prisma.io/docs/prisma-server/). This API can be used to as foundation for an application-layer GraphQL API created with GraphQL binding. 

With Prisma 2, Prisma's query engine doesn't expose a [spec](https://graphql.github.io/graphql-spec/June2018/)-compliant GraphQL endpoint any more, so usage of schema delegation and GraphQL binding with Prisma 2 is not officially supported. To build GraphQL servers with Prisma 2, be sure to check out [GraphQL Nexus](https://nexus.js.org/) and its [`nexus-prisma`](https://nexus.js.org/docs/database-access-with-prisma-v2) integration. GraphQL Nexus provides a code-first and type-safe way to build GraphQL servers in a scalable way. 

### How to handle connection pooling for Prisma Client JS in serverless environments?

The query engine that's powering the Prisma Client JS API is maintaining a database connection pool. In serverless environments (or when running your application in containers, e.g. using Kubernetes), this connection pool might loose its effectiveness due to the infrastructure it's being deployed on. You can read more about this topic in the [docs](./prisma-client-js/deployment.md).

As of now, the recommended workaround is to use a tool like [PgBouncer](https://pgbouncer.github.io/faq.html). We are further exploring some options, such as [enabling a "DB proxy server"](https://github.com/prisma/prisma2/issues/370) (e.g. using a specific generator that generates a Docker image to host Prisma Client JS' query engine) that manages the connection pool for you (similar to the the Prisma 1 architecture).

Also note that there some cloud offerings start to have solutions for connection pooling out-of-the-box, such as [AWS Aurora](https://aws.amazon.com/blogs/aws/new-data-api-for-amazon-aurora-serverless/).

## Migrations

### Am I locked-in when using Prisma's migration tool? Is it easy to migrate off it?

There's absolutely no lock-in with Prisma's migration tool. To stop using Prisma for your migrations, you can delete your [Prisma schema file](./prisma-schema-file.md), all existing migration folders on your file system and the `migrations` table in your database/schema.

### How do I see details about how Prisma migrates my database schema?

Each migration is represented via its own directory on your file system. The name of each directory contains a timestamp so that the order of all migrations in the project history can be maintained. Each of these migration directories contains detailed information about the respective migration, for example which steps are executed (and in what order) as well as a human-friendly markdown file that summarizes the most important information about the migration, such as the source and the target [data model definition](./data-modeling.md#data-model-definition) of the migration. This information can also be found in the `migrations` table in your database/schema. 

Also, the `migrate` CLI constantly prints the migration statements and more information when you're running its commands.

### Is Prisma's migration tool production-ready? Should I start using it?

Prisma's migration tool is not yet production-ready, it has a number of [limitations](./limitations.md) that don't make it suitable for production uses. You can track the progress of the release process on [isprisma2ready.com](https://www.isprisma2ready.com). 

While it shouldn't be used for critical applications yet, Prisma's migration tool is definitely in a usable state. You can help us accelerate the release process by using it and [sharing your feedback](./prisma2-feedback.md) with us.

## Other

### Since Prisma 2 is released, will Prisma 1 still be maintained?

Yes, Prisma 1 will continue to be maintained. However, most Prisma engineering resources will go into the development of [Prisma 2](https://github.com/prisma/prisma2).

There will be no new features developed for Prisma 1.

### Where can I get more information about the plans for Prisma 2?

Check out the [`specs`](https://github.com/prisma/specs) repo which contains the technical specifications for future Prisma 2 features. Get involved by [creating issues](https://github.com/prisma/prisma2/issues) and [sharing feedback](./prisma2-feedback.md)!

### How much does Prisma 2 cost?

Prisma 2 is open source and using it is free of any charge! In the future, Prisma will offer additional cloud services to facilitate various database- and Prisma-related workflows. Note that these are optional, Prisma 2 can continue to be used without consuming any commercial services.