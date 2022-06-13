# Welcome!

Welcome! You've arrived at our Contributing page and are now one step away from joining our quest to make databases easy. We're thankful for all your contributions, whether it's helping us find issues in our code, highlighting features we're missing, or contributing to the codebase. If you've found your way here, you'll soon be ready to join in the fun of building features and fixing bugs directly with us - and we're thrilled to have you on board!

To get you started on a good foot, we've created an easy overview of the most important things to get you started contributing code to Prisma below as well as a [Code of Conduct](https://github.com/prisma/prisma/blob/master/CODE_OF_CONDUCT.md) for contributing to the development of Prisma.

We also encourage you to join our sprawling [community](https://www.prisma.io/community) online, where you can discuss ideas, ask questions and get inspiration for what to build next.

## Contributing Code

Welcome to the monorepo for our TypeScript code for the Prisma ORM. (for the Engines' code written in Rust [it's there](https://github.com/prisma/prisma-engines))

## General Prerequisites

1. Install Node.js `>=14` minimum, [latest LTS is recommended](https://nodejs.org/en/about/releases/)

   - Recommended: use [`nvm`](https://github.com/nvm-sh/nvm) for managing Node.js versions

1. Install [`pnpm`](https://pnpm.io/) (for installing npm dependencies, using pnpm workspaces)
1. Install [`docker`](https://www.docker.com/products/docker-desktop) (for managing databases for our tests)
1. Install [`ts-node`](https://github.com/TypeStrong/ts-node) (for running Node.js scripts written in TypeScript)
1. Install [`direnv`](https://github.com/direnv/direnv/blob/master/docs/installation.md) (for managing .envrc for environment variables)

https://github.com/direnv/direnv/blob/master/docs/installation.md

Copy paste these commands to install the global dependencies:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install 16
npm install --global pnpm@6 ts-node
# For direnv see https://github.com/direnv/direnv/blob/master/docs/installation.md
```

## General Setup

To set up and build all the packages, follow these steps:

```bash
git clone https://github.com/prisma/prisma.git
cd prisma
pnpm i
pnpm run setup
```

> 💡 For Windows users: use the latest version of [Git Bash](https://gitforwindows.org/).

## Building packages when you make changes

In the root directory:

- `pnpm run setup` will install and build all the packages
- `pnpm -r run build` (-r for recursive) will build all the packages
- `pnpm -r run dev` (-r for recursive) will build all the packages, without running `tsc`
- `pnpm run watch` will continuously build any packages that have been modified, without running `tsc` (Fastest)

In a package directory, like `packages/client`:

- `pnpm run build` will build the package
- `pnpm run dev` will build the package without running `tsc` (Fastest)

> 💡 Our builder is built on top of esbuild

## Prisma Client

### First contribution

Create a reproduction folder for developing, trying a new feature, or a fix.

#### Setting up a locally-linked development folder

Set up a local project that will be linked to the local packages.

```sh
cd reproductions && pnpm install
# Copy a template from the reproduction folder
cp -r basic-sqlite my-repro && cd my-repro
# Ensure that the db and the schema are synced
pnpx prisma db push --skip-generate
# Do some code changes, always re-generate the client, then try it out
pnpx prisma generate && pnpx ts-node index.ts
```

> 💡 This works best when compiling with `pnpm run watch` in the background.

> 💡 In any successful setup `pnpx prisma -v` should return version `0.0.0`.

<details>
  <summary><b>Alternatives</b></summary>
  
  #### Detailed steps for a locally-linked dev folder
  ```sh
  cd reproductions
  mkdir my-repro
  cd my-repro
  pnpm init -y
  pnpm add ../../packages/client
  pnpm add -D ../../packages/cli
  pnpm add -D typescript ts-node
  pnpm add -D @types/node
  touch index.ts
  pnpx tsc --init
  pnpx prisma init
  # > Manually populate the schema.prisma
  # > Manually add 👇 to the generator block
  #   output = "../node_modules/.prisma/client"
  # > Manually populate the index.ts
  pnpx prisma db push --skip-generate
  pnpx prisma generate && pnpx ts-node index.ts # Try it out
  ```

#### Developing and working in the fixture folder

```sh
cd packages/client
ts-node fixtures/generate.ts ./fixtures/blog/ --skip-transpile
cd fixtures/blog
npx prisma db push --skip-generate
ts-node main.ts # Try it out
```

</details>

### Tests

For an overview, adding, running tests & guidelines see [TESTING.md](./TESTING.md).

#### Integration tests

We have two kinds of integration tests:

#### Prisma Client folder-based integration tests (`./client`)

The integration tests consisting of mini projects are located in [`src/client/src/__tests__/integration`](./packages/client/src/__tests__/integration)

Run the tests:

```sh
cd packages/client
pnpm run test integration
```

##### Creating a new folder-based integration test

If you want to create a new one, we recommend to copy over the [minimal test](https://github.com/prisma/prisma/tree/main/packages/client/src/__tests__/integration/happy/minimal) and adjust it to your needs.
It will give you an in-memory Prisma Client instance to use in the test. It utilizes the `getTestClient`) helper method.

Sometimes you need an actual generated Client, that has been generated to the filesystem. In that case use `generateTestClient`. An example that uses this helper is the [blog example](https://github.com/prisma/prisma/tree/main/packages/client/src/__tests__/integration/happy/blog)

#### General Client integration tests (`./integration-tests`)

The integration tests consisting of mini project are located in [`packages/integration-tests/src/__tests__/integration`](./packages/integration-tests/src/__tests__/integration)

Run the tests:

```sh
cd packages/integration-tests
pnpm run test
```

## Prisma Migrate

### First contribution

1. `cd packages/migrate/fixtures/blog` it's a minimal project that can be used to try things out
1. Then modify some code
1. `../../src/bin.ts dev` for running `prisma migrate dev`

> 💡 You can also test your changes in a reproduction project via the [CLI](#developing-prisma-cli).

### Tests

For an overview, adding, running tests & guidelines see [TESTING.md](./TESTING.md).

Tests fixtures are located in [`./packages/migrate/src/__tests__/fixtures`](./packages/migrate/src/__tests__/fixtures)

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TESTING.md](./TESTING.md)
- [Prisma Docs](https://www.prisma.io/docs/)
- [TablePlus](https://tableplus.com/) is a great GUI for databases, useful for managing sqlite database fixtures for example.

## Prisma CLI

### First contribution

Create a reproduction folder for developing, trying a new feature, or a fix.

#### Setting up a locally-linked development folder

Set up a local project that will be linked to the local packages.

```sh
cd reproductions && pnpm install
# Copy a template from the reproduction folder
cp -r basic-sqlite my-repro && cd my-repro
# Do some code changes, compile, then try it out
pnpx prisma generate
```

> 💡 This works best when compiling with `pnpm run watch` in the background.

> 💡 In any successful setup `pnpx prisma -v` should return version `0.0.0`.

<details>
  <summary><b>Alternatives</b></summary>

```sh
cd packages/cli
../src/bin.ts generate # Try it out
```

</details>

## Conventions

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
- debug
- engine-core
- generator-helper
- migrate
- react-prisma
- sdk
- tests

## Legal

Pull Request authors must sign the [Prisma CLA](https://cla-assistant.io/prisma/prisma), it will show up in an automated comment after you create a PR.

If you cannot or do not want to sign this CLA (e.g. your employment contract for your employer may not allow this), you should not submit a PR.
Open an issue and someone else can do the work.
