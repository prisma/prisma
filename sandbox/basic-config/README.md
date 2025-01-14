# Basic Config

## Set up

In the root of the repository:
- Run a PostgreSQL database via Docker
  ```bash
  docker compose -f docker/docker-compose.yml up postgres
  ```

In the `sandbox/basic-config` directory:
- Install dependencies
  ```bash
  pnpm i
  ```
- Prepare the database
  ```bash
  pnpm prisma db push
  ```
- Run the example "worker" script, which will use `prisma.config.ts` to inject the configuration to Prisma Client:
  ```bash
  pnpm demo:worker
  ```