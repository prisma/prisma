# CLI test fixture app

A package whose only job is to declare the dependencies a test project needs to
resolve. Tests create their project directories underneath it — see
`createTestProjectDir` in `../utils/test-project-dir.ts` — so Node walks up from
the project into this package's `node_modules`.

Project directories in the OS temp directory cannot do that. pnpm links
dependencies per package, and the CLI package itself does not declare
`@prisma/orm-postgres`, `@prisma/orm-mongo` or `dotenv`, so a scaffolded
`prisma.config.ts` written outside the repo fails to import them.

A test project here sits inside the repository's own pnpm workspace, so
package-manager detection resolves to pnpm. That is the correct answer for a
project in this position, and nothing here overrides it — which manager runs an
install is the CLI engine's concern, not this package's. A test asserts the
packages `init` asks for, never the manager that installs them.

Every subdirectory named `test-*` is ephemeral test output and is gitignored.
