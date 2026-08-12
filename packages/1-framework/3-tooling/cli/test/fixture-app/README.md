# CLI test fixture app

A package whose only job is to declare the dependencies a test project needs to
resolve. Tests create their project directories underneath it — see
`createTestProjectDir` in `../utils/test-project-dir.ts` — so Node walks up from
the project into this package's `node_modules`.

Project directories in the OS temp directory cannot do that. pnpm links
dependencies per package, and the CLI package itself does not declare
`@prisma/orm-postgres`, `@prisma/orm-mongo` or `dotenv`, so a scaffolded
`prisma-next.config.ts` written outside the repo fails to import them.

The `packageManager` field stops package-manager detection here. `init` picks
the manager by walking up from the project it is scaffolding, and without this
it would walk out of the fixture package and find the repository's own pnpm
lockfile — so every test project would look like part of a pnpm workspace, and
`init` would report the repository's catalog as the project's. Declaring npm
gives a test project the same neutral answer it got outside the repository, and
a test that wants a different one writes its own lockfile into the project.

Every subdirectory named `test-*` is ephemeral test output and is gitignored.
