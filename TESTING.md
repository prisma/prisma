# Where should I write the test?

Something is broken? You built a new feature? Time to write a test!

But where?

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
- **`integration-tests`**
  - Integration tests for basic query and mutation functionality
  - All databases that we support are covered here:
    - mariadb
    - mssql
    - mysql
    - postgresql
    - sqlite
  - While these tests also test the client itself, they're rather just our base to make sure that basic query engine functionality actually works in the Prisma Client
  - When you want to test very specific queries for a new feature, you can write an integration test in the `client` package, as that's usually easier

### So you just got a reproduction for the client...

If the users did their homework and provide a reproduction repository, you usually just want to turn that into an integration test in the `client` package. If it's about an ugly error, that could be handled nicer, it should go into `integration/errors`. If it's about making sure, that a specific feature works as intended, you can create a new test case in `integration/happy`.

The `integration/happy/minimal` test is always a good start if you just want to test the JS interface of the client.

In case you want to test the actually generated client, have a look at the `integration/happy/blog` test as an example.
