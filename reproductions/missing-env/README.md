Reproduction for https://github.com/prisma/prisma/issues/17797.
This branch is based on `main` without the commit added by https://github.com/prisma/prisma/pull/17455.

---

## Steps to reproduce

1. Modify the versions of `@prisma/client` and `prisma` in `package.json` to:

- `4.10.0-dev.21` (latest dev version before the regression)
- `4.10.0-dev.22` (first dev version with the regression, caused by https://github.com/prisma/prisma/pull/17455)

2. Install Node.js dependencies from scratch and generate Prisma Client types:

```sh
rm -rf node_modules && pnpm i && npx prisma generate
```

3. Run the reproduction:

```sh
pnpm test
```

## Expected behavior

- with `@prisma/client` and `prisma` versions `4.10.0-dev.21` (or `4.9.0`), and using the local `../../packages/` version:

  ```sh
  ❯ pnpm test

  > missing-env@ test /Users/jkomyno/work/prisma/prisma/reproductions/missing-env
  > node -r ts-node/register --enable-source-maps index.ts

  App listening at http://localhost:3000
  ```

  (the server starts successfully, you will need to manually kill it with `Ctrl+C`)

- with `@prisma/client` and `prisma` versions `4.10.0-dev.22` and beyond:

  ```sh
  ❯ pnpm test

  > missing-env@ test /Users/jkomyno/work/prisma/prisma/reproductions/missing-env
  > node -r ts-node/register --enable-source-maps index.ts

  App listening at http://localhost:3000
  /Users/jkomyno/work/prisma/prisma/reproductions/missing-env/node_modules/.prisma/client/runtime/index.js:27303
            throw new PrismaClientInitializationError(error2.message, this.config.clientVersion, error2.error_code);
                  ^
  PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL_MISSING.
    -->  schema.prisma:7
    |
  6 |   provider = "postgres"
  7 |   url      = env("DATABASE_URL_MISSING")
    |

  Validation Error Count: 1
      at LibraryEngine.loadEngine (/Users/jkomyno/work/prisma/prisma/reproductions/missing-env/node_modules/.prisma/client/runtime/index.js:27303:17)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at async LibraryEngine.instantiateLibrary (/Users/jkomyno/work/prisma/prisma/reproductions/missing-env/node_modules/.prisma/client/runtime/index.js:27232:5) {
    clientVersion: '4.10.0-dev.22',
    errorCode: 'P1012'
  }
   ELIFECYCLE  Test failed. See above for more details.
  ```

  (the server fails to start with exit code `1`)
