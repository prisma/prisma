# Testing

## Local databases for tests

To run tests requiring a database, start the test databases using Docker, see [Docker](./docker/README.md).

## Environment variables

- Create a `.envrc` in the root directory of the project with this content:

  ```sh
  export TEST_POSTGRES_URI="postgres://prisma:prisma@localhost:5432/tests"
  export TEST_POSTGRES_ISOLATED_URI="postgres://prisma:prisma@localhost:5435/tests"
  export TEST_POSTGRES_URI_MIGRATE="postgres://prisma:prisma@localhost:5432/tests-migrate"
  export TEST_POSTGRES_SHADOWDB_URI_MIGRATE="postgres://prisma:prisma@localhost:5432/tests-migrate-shadowdb"

  export TEST_MYSQL_URI="mysql://root:root@localhost:3306/tests"
  export TEST_MYSQL_ISOLATED_URI="mysql://root:root@localhost:3307/tests"
  export TEST_MYSQL_URI_MIGRATE="mysql://root:root@localhost:3306/tests-migrate"
  export TEST_MYSQL_SHADOWDB_URI_MIGRATE="mysql://root:root@localhost:3306/tests-migrate-shadowdb"

  export TEST_MARIADB_URI="mysql://prisma:prisma@localhost:4306/tests"

  export TEST_MSSQL_URI="mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/tests" # for `mssql` lib used in some tests
  export TEST_MSSQL_JDBC_URI="sqlserver://localhost:1433;database=tests;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
  export TEST_MSSQL_JDBC_URI_MIGRATE="sqlserver://localhost:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
  export TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE="sqlserver://localhost:1433;database=tests-migrate-shadowdb;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"

  export TEST_MONGO_URI="mongodb://root:prisma@localhost:27017/tests?authSource=admin"

  export TEST_COCKROACH_URI=postgresql://prisma@localhost:26257/
  ```

- Load the environnment variables with:

  ```sh
  direnv allow
  ```

OR 

- Choose the env variables the tests you want to run use, and execute the command from above manually in your terminal.

## Test / Jest tips

1. We use the [Jest test framework](https://jestjs.io/), and make the adequate command in each package available via a `test` npm script. These are the most important options you should know:

   ```sh
   pnpm run test <fileNamePattern> -- -t <testNamePattern>
   ```

   and to update snapshots use the -u option like this (the `--` are required, anything after the dashes will be passed to Jest):

   ```sh
   pnpm run test <fileNamePattern> -- -u
   ```

1. In `integration-tests` [Jest's `each` feature](https://jestjs.io/docs/en/api#testeachtablename-fn-timeout) is used. If you only want to run a subset of the test cases, simply leverage the `-t` flag on the command line (see above point). For example in `packages/cli` here is how you would run Just the `findOne where PK` cases for sqlite integration:

   ```sh
   pnpm run jest integration.sqlite -t 'findOne where PK'
   ```

## Common Use Cases

### Run only specific test in specific package

If you want to run only one specific test that only uses one specific database, this is the minimal setup 

```
# via CONTRIBUTING.md
npm install -g pnpm && pnpm i && pnpm run setup

# via docker/README.md
cd docker && docker-compose up -d mysql && cd ..

# via this file
export TEST_MYSQL_URI="mysql://root:root@localhost:3306/tests"
cd packages/client
npm run test referentialActions-mysql -t defaults
```

## Where should I find and write tests?

Something is broken? You built a new feature? It's time to write a test! But where?

Everything related to working with specific frameworks like Next.js or deploying to Netlify should be covered by an [End-to-End Test](https://github.com/prisma/e2e-tests).

Everything that is more basic functionality like a specific query or feature, that doesn't need a platform specific test (yet) should get a test in the `prisma/prisma` repo.

Rule of thumb: If you can write a test in `prisma/prisma`, prefer that over a test in `prisma/e2e-tests`.

In the `prisma/prisma` repository we have a few places where you can write tests:

- **`packages/cli`**
  - Tests for CLI commands `prisma studio`, `prisma version`, `prisma format`, `prisma generate`, `prisma init`, `prisma doctor`, loading .env files, testing the built cli, update messages
- **`packages/client`**
  - `src/__tests__/*.test.ts` - Unit tests
  - `src/__tests__/integration/happy/**` - Integration tests for the happy path
  - `src/__tests__/integration/errors/**` - Integration tests for error cases
  - `src/__tests__/types/**` - Tests for generated Client TS Types
- **`packages/debug`**
  - Unit tests for `debug` package
- **`packages/engine-core`**
  - Unit tests for `engine-core` package
- **`packages/generator-helper`**
  - Integration tests for generator interface implementation
- **`packages/integration-tests`** (Prisma Client & Introspection)
  - Integration tests for basic query and mutation functionality
  - All databases that we support are covered here:
    - mariadb
    - mssql (SQL Server)
    - mysql
    - postgresql
    - sqlite
  - While these tests also test the client itself, they're rather just our base to make sure that basic query engine functionality actually works in the Prisma Client
  - When you want to test very specific queries for a new feature, you can write an integration test in the `client` package, as that's usually easier
- **`packages/migrate`**
  - Unit and integration tests for `migrate` and `db` CLI commands
- **`packages/react-prisma`**
  - Doesn't have tests
- **`packages/sdk`**
  - Convert credentials to connection string and back
  - Dotenv expansion
  - Engine commands (`getDMMF`, `getConfig`) (snapshots)
  - getGenerators (central function for generation)
  - Introspection (snapshots)

## So you just got a reproduction for the client

If the users did their homework and provide a reproduction repository, you usually just want to turn that into an integration test in the `client` package.
If it's about an ugly error, that could be handled nicer, it should go into `integration/errors`.
If it's about making sure, that a specific feature works as intended, you can create a new test case in `integration/happy`.

The `integration/happy/minimal` test is always a good start if you just want to test the JS interface of the client.

In case you want to test the actually generated client, have a look at the `integration/happy/blog` test as an example.

## CI - Continuous Integration

By creating a Pull Request the following pipelines will be triggered

- [Buildkite `[Test] Prisma TypeScript`](https://buildkite.com/prisma/test-prisma-typescript)
- [GitHub Action `CI`](https://github.com/prisma/prisma/blob/main/.github/workflows/test.yml)

They are both running the same tests but with different Node.js version and will need to be successful before merging.
