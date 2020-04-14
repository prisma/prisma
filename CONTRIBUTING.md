# Contributing

Prisma consists of a mono-repo for all TypeScript code.
To setup and build the packages, follow these steps:

```bash
cd src
npm i -g pnpm
pnpm i --ignore-scripts
pnpm run setup
```

Note for Windows: Use the latest version of [Git Bash](https://gitforwindows.org/)

### [Developing Prisma Client JS](https://github.com/prisma/prisma-client-js/tree/master/packages/photon#contributing)

### Developing Prisma Migrate

1. `cd src/packages/migrate/fixtures/blog`
2. `ts-node ../../src/bin.ts up`

### Developing `prisma init` Command

1. `cd src/packages/introspection`
2. `mkdir test && cd test`
3. `ts-node ../src/bin.ts`

### Developing `@prisma/cli` CLI

1. `cd src/packages/prisma2`
2. `mkdir test && cd test`
3. `ts-node ../src/bin.ts generate`

### How to update all binaries

```bash
# In the root directory
pnpm run download
```

### Running the CI system locally
```bash
cd src/.buildkite/test
docker-compose up -d
docker-compose logs -f app
```
