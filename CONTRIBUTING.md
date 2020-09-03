# Contributing

Prisma consists of a mono-repo for all TypeScript code.
To setup and build the packages, follow these steps:

```bash
git clone https://github.com/prisma/prisma.git
cd prisma/src
npm i -g pnpm@5.1.7
pnpm i --ignore-scripts
pnpm run setup
```

Note for Windows: Use the latest version of [Git Bash](https://gitforwindows.org/)

### General prerequisites

1. Install [`pnpm@5.1.7`](https://pnpm.js.org/) (for installing npm dependencies)
1. Install [`docker`](https://www.docker.com/products/docker-desktop) (for managing test databases)

### Developing Prisma Client JS

1. `cd src/packages/client`
1. `ts-node fixtures/generate.ts ./fixtures/blog/ --skip-transpile`
1. `cd fixtures/blog`
1. `export DB_URL=YOUR_POSTGRES_DB_URL`  
   For this step you might find our [docker-compose setup](./src/docker) helpful
1. `npx @prisma/cli migrate save --create-db --name init --experimental && npx @prisma/cli migrate up --experimental`
1. `ts-node main`

### Running integration tests for Prisma Client JS

Start the test databases (see [readme](./src/docker) for various ways to run these)

1. `cd src/docker`
1. `docker-compose up -d`

Start the tests

1. `cd src/packages/cli`
2. `pnpm run test`

Notes:

- To update the snapshots add the following env var `SNAPSHOT_UPDATE=1`
- If on a patch branch then the latest engine binary patch version for that semver-minor series will be used. If not on a patch branch then the current `master` engine binary version will be used. A patch branch is a branch whose name matches semver pattern `2.<minor>.x`. The Test suite will log which engine binary is being used at the start of testing.

### Working on code generation

If you have your local blog fixture running, you can now do changes to `TSClient.ts` and re-execute `npx ts-node fixtures/generate.ts ./fixtures/blog/`.

When doing changes and working on a fixture use `yarn build && rm -rf fixtures/blog/node_modules/ && ts-node fixtures/generate.ts fixtures/blog`

### Working with the runtime

If you want to use the local runtime in the blog fixture, run

```sh
ts-node fixtures/generate.ts ./fixtures/blog/ --local-runtime
```

Changes to `query.ts` will then be reflected when running `fixtures/blog/main.ts`

### Developing Prisma Migrate

1. `cd src/packages/migrate/fixtures/blog`
1. `ts-node ../../src/bin.ts up`

### Developing `prisma init` Command

1. `cd src/packages/introspection`
1. `mkdir test && cd test`
1. `ts-node ../src/bin.ts`

### Developing `@prisma/cli` CLI

1. `cd src/packages/prisma2`
1. `mkdir test && cd test`
1. `ts-node ../src/bin.ts generate`

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

### Git Commit Messages

We structure our messages like this:

```
<type>(<package>): <subject>
<BLANK LINE>
<body>
```

Example

```
feat(client): new awesome feature

Closes #111
```

List of types:

- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing or correcting existing tests
- chore: Changes to the build process or auxiliary tools and libraries such as documentation generation

List of packages:

- cli
- client
- engine-core
- fetch-engine
- generator-helper
- get-platform
- ink-components
- migrate
- sdk
- introspection
