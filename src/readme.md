# Prisma 2 Development Environment

```console
npm install -g pnpm
pnpm install
pnpm run setup
```

Note for Windows: Use the latest version of [Git Bash](https://gitforwindows.org/)

### [Developing Prisma Client JS](https://github.com/prisma/prisma-client-js/tree/master/packages/photon#contributing)

### Developing Prisma Migrate

1. `cd migrate/fixtures/blog`
2. `ts-node ../../src/bin.ts up`

### Developing `prisma init` Command

1. `cd prisma/cli/introspection`
2. `mkdir test && cd test`
3. `ts-node ../src/bin.ts`

### Developing `@prisma/cli` CLI

1. `cd prisma/cli/prisma2`
2. `mkdir test && cd test`
3. `ts-node ../src/bin.ts generate`

### How to update all binaries

```bash
# In the root directory
pnpm run download
```

### Running the CI system locally
```bash
cd .buildkite/publish
docker-compose up -d
docker-compose logs -f app
```
