# Prisma Driver Adapters

This TypeScript monorepo contains the following packages:
- `@jkomyno/prisma-driver-adapter-utils` (later: `@prisma/driver-adapter-utils`)
  - Internal set of utilities and types for Prisma's driver adapters.
- `@jkomyno/prisma-adapter-neon` (later: `@prisma/adapter-neon`)
  - Prisma's Driver Adapter that wraps the `@neondatabase/serverless` driver
  - It uses `provider = "postgres"`
  - It exposes debug logs via `DEBUG="prisma:driver-adapter:neon"`
- `@jkomyno/prisma-adapter-planetscale` (later: `@prisma/adapter-planetscale`)
  - Prisma's Driver Adapter that wraps the `@planetscale/database` driver
  - It uses `provider = "mysql"`
  - It exposes debug logs via `DEBUG="prisma:driver-adapter:planetscale"`
- `@jkomyno/prisma-adapter-pg` (later: `@prisma/adapter-pg`)
  - Prisma's Driver Adapter that wraps the `pg` driver
  - It uses `provider = "postgres"`
  - It exposes debug logs via `DEBUG="prisma:driver-adapter:pg"`

## Get Started

We assume Node.js `v18.16.1`+ is installed. If not, run `nvm use` in the current directory.
This is very important to double-check if you have multiple versions installed, as PlanetScale requires either Node.js `v18.16.1`+ or a custom `fetch` function.

Install `pnpm` via:

```sh
npm i -g pnpm
```

## Development

- Install Node.js dependencies via `pnpm i`
- Build and link TypeScript packages via `pnpm build`
- Publish packages to `npm` via `pnpm publish -r`
