# Testing

## Local databases for tests

To run tests requiring a database, start the test databases using Docker, see [Docker](./docker/README.md).

## Jest tips

1. We use the [Jest test framework](https://jestjs.io/). Its CLI is powerful and removes the need for npm scripts mostly. For most cases this is what you need to know:

   ```sh
   pnpm run jest <fileNamePattern> -t <testNamePattern>
   ```

   and to update snapshots use the -u option like this:

   ```sh
   pnpm run jest <fileNamePattern> -- -u
   ```

1. Some integration tests in these packages use [Jest's `each` feature](https://jestjs.io/docs/en/api#testeachtablename-fn-timeout). If you only want to run a subset of the test cases, simply leverage the `-t` flag on the command line (see above point). For example in `packages/cli` here is how you would run Just the `findOne where PK` cases for sqlite integration:

   ```sh
   pnpm run jest integrate.sqlite -t 'findOne where PK'
   ```

   Also you can piggy back flags onto existing npm scripts. For example the above could be rewritten as:

   ```sh
   pnpm run test:sqlite -t 'findOne where PK'
   ```

## Where should I find and write tests?

Something is broken? You built a new feature? It's time to write a test! But where?

Everything related to working with specific frameworks like Next.js or deploying to Netlify should be covered by an [End-to-End Test](https://github.com/prisma/e2e-tests).

Everything that is more basic functionality like a specific query or feature, that doesn't need a platform specific test (yet) should get a test in the `prisma/prisma` repo.

Rule of thumb: If you can write a test in `prisma/prisma`, prefer that over a test in `prisma/e2e-tests`.

In the `prisma/prisma` repository we have a few places where you can write tests:

- **`cli`**
  - Tests for `prisma studio`, `prisma version`, `prisma format`, `prisma generate`, `prisma doctor`, loading .env files, testing the built cli
- **`client`**
  - `src/__tests__/*.test.ts` - Unit tests
  - `src/__tests__/integration/happy/**` - Integration tests for the happy path
  - `src/__tests__/integration/errors/**` - Integration tests for error cases
  - `src/__tests__/types/**` - Tests for generated Client TS Types
- **`debug`**
  - Unit tests for `debug` package
- **`engine-core`**
  - Unit tests for `engine-core` package
- **`generator-helper`**
  - Integration tests for generator interface implementation
- **`migrate`**
  - Unit and integration tests for `migrate` and `db` commands
- **`react-prisma`**
  - Doesn't have tests
- **`sdk`**
  - Convert credentials to connection string and back
  - Dotenv expansion
  - Engine commands (`getDMMF`, `getConfig`) (snapshots)
  - getGenerators (central function for generation)
  - introspection (snapshots)
- **`integration-tests`** (Prisma Client & Introspection)
  - Integration tests for basic query and mutation functionality
  - All databases that we support are covered here:
    - mariadb
    - mssql (SQL Server)
    - mysql
    - postgresql
    - sqlite
  - While these tests also test the client itself, they're rather just our base to make sure that basic query engine functionality actually works in the Prisma Client
  - When you want to test very specific queries for a new feature, you can write an integration test in the `client` package, as that's usually easier

## So you just got a reproduction for the client

If the users did their homework and provide a reproduction repository, you usually just want to turn that into an integration test in the `client` package.
If it's about an ugly error, that could be handled nicer, it should go into `integration/errors`.
If it's about making sure, that a specific feature works as intended, you can create a new test case in `integration/happy`.

The `integration/happy/minimal` test is always a good start if you just want to test the JS interface of the client.

In case you want to test the actually generated client, have a look at the `integration/happy/blog` test as an example.
