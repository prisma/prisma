# GraphQL Apollo Server Example

This example shows how to implement a **GraphQL server with TypeScript** based on Prisma, [apollo-server](https://www.apollographql.com/docs/apollo-server/) and [GraphQL Nexus](https://graphql-nexus.com/).

**INLINE(../\_setup-1.md)**
cd examples/typescript/graphql-apollo-server
**INLINE(../\_setup-2.md)**

**INLINE(../\_start-graphql-server.md)**

**INLINE(../../\_using-the-graphql-api.md)**

### 6. Changing the GraphQL schema

To make changes to the GraphQL schema, you need to manipulate the `Query` and `Mutation` types that are defined in [`index.ts`](./src/index.ts).

Note that the [`start`](./package.json#L6) script also starts a development server that automatically updates your schema every time you save a file. This way, the auto-generated [GraphQL schema](./src/generated/schema.graphql) updates whenever you make changes in to the `Query` or `Mutation` types inside your TypeScript code.

**INLINE(../\_next-steps.md)**
