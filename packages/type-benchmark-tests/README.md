# Type Benchmark Tests

This package contains type benchmarks tests using [attest](https://github.com/arktypeio/arktype).

These were initially developed together with [David Blass](https://github.com/ssalbdivad).

This test suite shall ensure that we are not running into regressions with our type checking performance.

## Usage

- Make sure the overall monorepo has dependency installed (`pnpm install` in root) and is build (`pnpm build` in root).
- Run `pnpm test` to run the test suite
- Run `pnpm test:update` to update snapshot recordings
- Run `pnpm test <filter>` to run only files including <filter> in their filename
- Run `pnpm test:update <filter>` to only update snapshots of files including <filter> in their filename

## Structure

- Each folder in this directory contains a different schema.
- Each schema can be tested with multiple `*.bench.ts` files.
- Each `*.bench.ts` file can contain multiple attest benchmarks and a dedicated baseline.
- The generated prisma client for each schema can be found in the `generated` subfolder after a test run.
