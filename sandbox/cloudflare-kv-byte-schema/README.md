## What if a byte-encoded Prisma Schema was loaded from Cloudflare KV?

> This is a proof of concept that demonstrates how to spin up `@prisma/client` on Cloudflare Workers with a byte-encoded Prisma Schema loaded from Cloudflare KV at runtime.

## How to use

1. Visit the published Worker at https://cloudflare-kv-byte-schema.schiabel.workers.dev/.
2. If an example JSON is returned with no errors, you successfully loaded a worker that requires a byte-encoded Prisma Schema from Cloudflare KV on demand.

## How to setup

1. Spin up a new Postgres database via Prisma's internal [database provisioning service](https://db-provision.cloud.prisma.io/).
2. Copy `.envrc.example` into `.envrc`, and fill in the missing environment variables. Copy the Postgres URL obtained from the previous step and store it into the `DATABASE_URL` environment variable.
3. Run `direnv allow` to load the environment variables locally.
4. Store the `DATABASE_URL` envionment variable into a new `.dev.vars` file as well, like so:
  ```text
  DATABASE_URL="postgresql://..."
  ```
  This will be used by Cloudflare Workers in development mode.
5. Push the Prisma schema and generate the Prisma Client via
  ```sh
  pnpm prisma db push
  ```
6. Store the byte-encoded Prisma Schema into Cloudflare KV via
  ```sh
  node prepare.js
  ```
7. Run the development server via
  ```sh
  pnpm wrangler dev --remote --port 8788
  ```
  *Note*: the `--remote` flag is required to use the actual Cloudflare KV service.
  At this time, there doesn't seem to be any publicly available utility for interacting with local Cloudflare KV emulated instances,
  besides spawning a shell and using the `wrangler kv:namespace` and `wrangler kv:key` CLI commands.
8. Visit `http://localhost:8788` to see the result. If an example JSON is returned with no errors, the setup was successful.
9. Deploy the worker via
  ```sh
  pnpm wrangler deploy --keep-vars
  ```
  You may need to set the `DATABASE_URL` environment variable manually in the Cloudflare Workers dashboard.
