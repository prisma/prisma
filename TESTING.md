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

export TEST_MSSQL_URI="mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master" # for `mssql` lib used in some tests
export TEST_MSSQL_JDBC_URI="sqlserver://localhost:1433;database=master;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
export TEST_MSSQL_JDBC_URI_MIGRATE="sqlserver://localhost:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
export TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE="sqlserver://localhost:1433;database=tests-migrate-shadowdb;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"

export TEST_MONGO_URI="mongodb://root:prisma@localhost:27018/tests?authSource=admin"
export TEST_MONGO_URI_MIGRATE="mongodb://root:prisma@localhost:27017/tests-migrate?authSource=admin"

export TEST_COCKROACH_URI=postgresql://prisma@localhost:26257/tests
```

- Load the environment variables with:

```sh
direnv allow
```

## Jest tips

1. We use the [Jest test framework](https://jestjs.io/). Its CLI is powerful and removes the need for npm scripts mostly. For most cases this is what you need to know:

Note: the following command `pnpm run test` can be used inside the packages folders like `packages/client`. In the base folder you can only run `pnpm run test` without extra arguments.

```sh
pnpm run test <fileNamePattern> -t <testNamePattern>
```

and to update snapshots use the -u option like this (the `--` are required, anything after the dashes will be passed to Jest):

```sh
pnpm run test <fileNamePattern> -- -u
```

1. In `integration-tests` [Jest's `each` feature](https://jestjs.io/docs/en/api#testeachtablename-fn-timeout) is used. If you only want to run a subset of the test cases, simply leverage the `-t` flag on the command line (see above point). For example in `packages/cli` here is how you would run Just the `findOne where PK` cases for sqlite integration:

   ```sh
   pnpm run jest integration.sqlite -t 'findOne where PK'
   ```

## Where should I find and write tests?

Something is broken? You built a new feature? It's time to write a test! But where?

Everything related to working with specific frameworks like Next.js or deploying to Netlify should be covered by an [Ecosystem Test](https://github.com/prisma/ecosystem-tests).

Everything that is more basic functionality like a specific query or feature, that doesn't need a platform specific test (yet) should get a test in the `prisma/prisma` repo.

Rule of thumb: If you can write a test in `prisma/prisma`, prefer that over a test in `prisma/ecosystem-tests`.

In the `prisma/prisma` repository we have a few places where you can write tests:

- **`cli`**
  - Tests for `prisma studio`, `prisma version`, `prisma format`, `prisma generate`, `prisma doctor`, loading .env files, testing the built cli
- **`client`**
  - `src/__tests__/*.test.ts` - Unit tests
  - `test/functional` - New functional tests setup
  - `src/__tests__/integration/happy/**` - Legacy integration tests for the happy path. Please, write functional tests instead.
  - `src/__tests__/integration/errors/**` - Legacy integration tests for error cases. Please write functional tests instead.
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
  - When you want to test very specific queries for a new feature, you can write a functional test in the `client` package, as that's usually easier

## So you just got a reproduction for the client

If the users did their homework and provide a reproduction repository, you usually just want to turn that into an integration test in the `client` package.
If it's about an ugly error, that could be handled nicer, it should go into `integration/errors`.
If it's about making sure, that a specific feature works as intended, you can create a new test case in `integration/happy`.

The `integration/happy/minimal` test is always a good start if you just want to test the JS interface of the client.

In case you want to test the actually generated client, have a look at the `integration/happy/blog` test as an example.

## How to trigger artificial panics

Sometimes it may be useful to trigger a panic in the Rust binaries or libraries used by Prisma under the hood.
Most of the Rust artifacts are shipped as binaries, whereas `query-engine` is shipped both as a library (by default) and as a binary (on demand).
To change the default Rust artifacts' type used under the hood, you can set the `PRISMA_CLI_QUERY_ENGINE_TYPE` environment variable to either `library` or `binary`.

### Setup

- `mkdir artificial-panics && cd artificial-panics`
- `npx prisma init --datasource-provider sqlite`

### Trigger panic in Migration Engine

- run `FORCE_PANIC_MIGRATION_ENGINE=1 npx prisma migrate dev`

### Trigger panic in Introspection Engine

- run `FORCE_PANIC_INTROSPECTION_ENGINE=1 npx prisma db pull`

### Trigger panic in Formatter

- run `FORCE_PANIC_PRISMA_FMT=1 npx prisma format`

### Trigger panic in Query Engine - Get DMMF

- run `FORCE_PANIC_QUERY_ENGINE_GET_DMMF=1 npx prisma validate`

### Trigger panic in Query Engine - Get Config

- run `FORCE_PANIC_QUERY_ENGINE_GET_CONFIG=1 npx prisma validate`

## Functional tests for the client

Functional tests in the client package are testing that all aspects of client and query engine work correctly. They strive to be as close as possible to the way client will be used in real project: they generate an actual client, talk to a real database, perform the type checks and generally test the client through its public API.

### Creating new functional test

To create new test, run following command

```
pnpm new-test
```

You'll then be asked for the name of your test and list of providers you want to run this test on. If you opt out of testing any of the providers, you'll also have to specify the reason. New test will be created under `test/functional/<name of the test>` directory.

### Structure of the functional test

Test consists of the 3 files:

- test matrix `_matrix.ts`
- schema template `prisma/_schema.ts`
- test suite `tests.ts`

#### Test matrix

`_matrix.ts` file defines parameters for generating test suites. It can have as many parameters as necessary, but at minimum, it should define at least one provider.

This matrix defines 2 test suites: one for SQLite provider and one for MongoDB, while also providing a corresponding ID string for each provider:

```ts
import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'mongodb',
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
    },
  ],
])
```

If matrix has multiple dimensions, test suites will be generated for all permutations of the parameters. For example. following matrix:

```ts
import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'postgresql',
    },
  ],
  [
    {
      providerFeatures: '',
    },

    {
      providerFeatures: 'improvedQueryRaw',
    },
  ],
])
```

Will generate following test suites:

- `{ provider: 'sqlite', providerFeatures: '' }`
- `{ provider: 'sqlite', providerFeatures: 'improvedQueryRaw' }`
- `{ provider: 'postgresql', providerFeatures: '' }`
- `{ provider: 'postgresql', providerFeatures: 'improvedQueryRaw' }`

#### Schema template

`prisma/_schema.ts` will be used for generating an actual schema for the test suite:

```ts
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${idForProvider(provider)}
    }
  `
})
```

`setupSchema` callback receives all parameters from the matrix for a particular test suite as an argument.
`idForProvider` is a helper function which returns a correct primary key definition for each of the supported providers.

#### Test suite

`tests.ts` contains actual tests for the suite:

```ts
import testMatrix from './_matrix'

// @ts-ignore at the moment this is necessary for typechecks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    test('findMany', async () => {
      await prisma.user.findMany()
    })
  },
  {
    optOut: {
      // if you are skipping tests for certain providers, you
      // have to list them here and specify the reason
      from: ['mongodb'],
      reason: 'The test is for SQL databases only',
    },
  },
)
```

This tests will run for every permutation of the parameters from the matrix. Each suite will start with a clean already set up database, generated and initialized client, available via `prisma` global. After suite is finished, database will be dropped and client instance will disconnect automatically.

### Running functional tests

- `pnpm test:functional:code` generates and runs the test suites, defined by test matrix. It does no typechecking, but prepares all necessary files for it.
- `pnpm test:functional:types` runs typechecking on all the suites, generated by `pnpm test:functional:code` command. If it reports any errors, you might want to examine generated test suite under `tests/functional/<your test name>/.generated` directory to get a better diagnostic.
- `pnpm test:functional` will run tests and perform type checks.

## CI - Continuous Integration

By creating a Pull Request the following pipelines will be triggered

- [Buildkite `[Test] Prisma TypeScript`](https://buildkite.com/prisma/test-prisma-typescript)
- [GitHub Action `CI`](https://github.com/prisma/prisma/blob/main/.github/workflows/test.yml)

They are both running the same tests but with different Node.js version and will need to be successful before merging ("flaky" tests might show up and might be ignored).

### Publishing an integration version of all the packages

If a branch name starts with `integration/` like `integration/fix-all-the-things` the [Buildkite `[Release] Prisma TypeScript`](https://buildkite.com/prisma/release-prisma-typescript) pipeline will be triggered.
If tests pass, a new version of the packages will be published to npm with a version like `3.12.0-integration-fix-all-the-things.1` (where `3.12.0-` is the current dev version prefix, `integration-` is statically added, `fix-all-the-things` is from the branch name and `.1` indicates the first version published from this integration branch)

To make a PR which will release an integration version, the name of the branch of the PR would need to start with `integration/`.
The `Buildkite [Release] Prisma TypeScript` will show its status in the PR checks and might take up to 30min to finish.

Once published to npm the version will need to be installed with the exact version like:

```
npm install -D prisma@3.12.0-fix-all-the-things.1

# or executed with npx like
npx prisma@3.12.0-fix-all-the-things.1
```

(Note that npm version upgrades or the update notifier in Prisma CLI might behave weird and unexpectedly with these integration versions.)

Internal note: You can check the #feed-prisma-releases channel on our private Slack to get notified when versions are published.

#### About [ecosystem-tests](https://github.com/prisma/ecosystem-tests/)

Once the integration version is published on npm:

- The `check-for-update` workflow, which runs continuously, will find the new version, update the package.json and do a commit on the [`integration` branch](https://github.com/prisma/ecosystem-tests/tree/integration)
- The tests worflows will then run for that commit and will be visible [here](https://github.com/prisma/ecosystem-tests/actions?query=branch%3Aintegration)
