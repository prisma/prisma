# @prisma/smoke-test-js

This is a playground for testing the `libquery` client with the experimental Node.js drivers.
It contains a subset of `@prisma/client`, plus some handy executable smoke tests:
- [`./src/libquery`](./src/libquery): it contains smoke tests using a local `libquery`, the Query Engine library.
- [`./src/client`](./src/client): it contains smoke tests using `@prisma/client`.

## How to setup

We assume a recent Node.js is installed (e.g., `v20.5.x`). If not, run `nvm use` in the current directory.
It's very important to double-check if you have multiple versions installed, as both PlanetScale and Neon requires either Node.js `v18`+ or a custom `fetch` function.

In the parent directory (`cd ..`):
- Build the driver adapters via `pnpm i && pnpm build`

In the current directoy:
- Create a `.envrc` starting from `.envrc.example`, and fill in the missing values following the given template
- Install Node.js dependencies via
  ```bash
  pnpm i
  ```

Anywhere in the repository:
- Run `cargo build -p query-engine-node-api` to compile the `libquery` Query Engine

### PlanetScale

If you don't have a connection string yet:

- [Follow the Notion document](https://www.notion.so/How-to-get-a-PlanetScale-and-Neon-database-for-testing-93d978061f9c4ffc80ebfed36896af16) or create a new database on [PlanetScale](https://planetscale.com/)
- Create a new database on [PlanetScale](https://planetscale.com/)
- Go to `Settings` > `Passwords`, and create a new password for the `main` database branch. Select the `Prisma` template and copy the generated URL (comprising username, password, etc). Paste it in the `JS_PLANETSCALE_DATABASE_URL` environment variable in `.envrc`.

In the current directory:
- Run `pnpm prisma:planetscale` to push the Prisma schema and insert the test data.
- Run `pnpm planetscale` to run smoke tests using `libquery` against the PlanetScale database.
  For more fine-grained control:
  - Run `pnpm planetscale:libquery` to test using `libquery`
  - Run `pnpm planetscale:client` to test using `@prisma/client`

### Neon

If you don't have a connection string yet:

- [Follow the Notion document](https://www.notion.so/How-to-get-a-PlanetScale-and-Neon-database-for-testing-93d978061f9c4ffc80ebfed36896af16) or create a new database with Neon CLI `npx neonctl projects create` or in [Neon Console](https://neon.tech).
- Create a new database with Neon CLI `npx neonctl projects create` or in [Neon Console](https://neon.tech).
- Paste the connection string to `JS_NEON_DATABASE_URL`. 

In the current directory:
- Run `pnpm prisma:neon` to push the Prisma schema and insert the test data.
- Run `pnpm neon:ws` to run smoke tests using `libquery` against the Neon database, using a WebSocket connection.
  For more fine-grained control:
  - Run `pnpm neon:ws:libquery` to test using `libquery`
  - Run `pnpm neon:ws:client` to test using `@prisma/client`
- Run `pnpm neon:http` to run smoke tests using `libquery` against the Neon database, using an HTTP connection. In this case, transactions won't work, and tests are expected to fail.
  For more fine-grained control:
  - Run `pnpm neon:ws:http` to test using `libquery`
  - Run `pnpm neon:ws:http` to test using `@prisma/client`
