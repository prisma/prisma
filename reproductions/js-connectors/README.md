# JS Connectors

This is a playground for testing the Prisma Client with JS Connectors (aka Node.js Drivers).

## How to setup

We assume Node.js `v18.16.1`+ is installed. If not, run `nvm use` in the current directory.
This is very important to double-check if you have multiple versions installed, as PlanetScale requires either Node.js `v18.16.1`+ or a custom `fetch` function.

- Create a `.envrc` starting from `.envrc.example`, and fill in the missing values following the given template
- Install Node.js dependencies via
  ```bash
  pnpm i
  ```

### PlanetScale

- Create a new database on [PlanetScale](https://planetscale.com/)
- Go to `Settings` > `Passwords`, and create a new password for the `main` database branch. Select the `Prisma` template and copy the generated URL (comprising username, password, etc). Paste it in the `JS_PLANETSCALE_DATABASE_URL` environment variable in `.envrc`.
- Create a new `shadow` database branch. Repeat the steps above (selecting the `shadow` branch instead of `main`), and paste the generated URL in the `JS_PLANETSCALE_SHADOW_DATABASE_URL` environment variable in `.envrc`.

In the current directory:

- Set the provider in [./prisma/mysql-planetscale/schema.prisma](./prisma/mysql-planetscale/schema.prisma) to `mysql`.
- Run `npx prisma db push --schema ./prisma/mysql-planetscale/schema.prisma`
- Run `npx prisma migrate deploy --schema ./prisma/mysql-planetscale/schema.prisma`
- Set the provider in [./prisma/mysql-planetscale/schema.prisma](./prisma/mysql-planetscale/schema.prisma) to `@prisma/planetscale`.

Note: you used to be able to run these Prisma commands without changing the provider name, but [#4074](https://github.com/prisma/prisma-engines/pull/4074) changed that (see https://github.com/prisma/prisma-engines/pull/4074#issuecomment-1649942475).

### Neon

- Create a new database with Neon CLI `npx neonctl projects create` or in [Neon Console](https://neon.tech).
- Paste the connection string to `JS_NEON_DATABASE_URL`. Create a shadow branch and repeat the step above, paste the connection string to `JS_NEON_SHADOW_DATABASE_URL`.

In the current directory:

- Set the provider in [./prisma/postgres-neon/schema.prisma](./prisma/postgres-neon/schema.prisma) to `postgres`.
- Run `npx prisma db push --schema ./prisma/postgres-neon/schema.prisma`
- Run `npx prisma migrate deploy --schema ./prisma/postgres-neon/schema.prisma`
- Set the provider in [./prisma/postgres-neon/schema.prisma](./prisma/postgres-neon/schema.prisma) to `@prisma/neon`.

## How to use

In the current directory:

- Run `pnpm planetscale` to run smoke tests against the PlanetScale database
- Run `pnpm neon` to run smoke tests against the PlanetScale database
