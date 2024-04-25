# Prisma Driver Adapters

This is a playground for testing the Prisma Client with Driver Adapters (aka Node.js Drivers).

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

In the current directory:

- Run `pnpm prisma:planetscale` to push the Prisma schema, insert the test data, and generate the Prisma Client.
- Run `pnpm planetscale` to run smoke tests against the PlanetScale database.

You can also observe more logs by specifying the environment variable `DEBUG="prisma:driver-adapter:planetscale"`.

### Neon

- Create a new database with Neon CLI `npx neonctl projects create` or in [Neon Console](https://neon.tech).
- Paste the connection string to `JS_NEON_DATABASE_URL`.

In the current directory:

- Run `pnpm prisma:neon` to push the Prisma schema, insert the test data, and generate the Prisma Client.
- Run `pnpm neon` to run smoke tests against the Neon database.

You can also observe more logs by specifying the environment variable `DEBUG="prisma:driver-adapter:neon"`.

## How to use

In the current directory:

- Run `pnpm planetscale` to run smoke tests against the PlanetScale database
- Run `pnpm neon` to run smoke tests against the PlanetScale database
