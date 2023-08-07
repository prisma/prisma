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

In the current directory:

- Run `pnpm prisma:planetscale` to push the Prisma schema, insert the test data, and generate the Prisma Client.
- Run `pnpm planetscale` to run smoke tests against the PlanetScale database.

The latest command should display a similar output:

```bash
❯ pnpm planetscale

> js-connectors@1.0.0 planetscale $(pwd)/reproductions/js-connectors
> ts-node ./src/planetscale.ts

[nodejs] connecting...
[nodejs] connected
[nodejs] findMany resultSet [
  {
    "tinyint_column": 127,
    "smallint_column": 32767,
    "mediumint_column": 8388607,
    "int_column": 2147483647,
    "float_column": 3.40282,
    "double_column": 1.797693134862316,
    "decimal_column": "99999999.99",
    "boolean_column": true,
    "char_column": "c",
    "varchar_column": "Sample varchar",
    "text_column": "This is a long text...",
    "date_column": "2023-07-24T00:00:00.000Z",
    "time_column": "1970-01-01T23:59:59.000Z",
    "datetime_column": "2023-07-24T23:59:59.000Z",
    "timestamp_column": "2023-07-24T23:59:59.000Z",
    "json_column": {
      "key": "value"
    },
    "enum_column": "value3",
    "binary_column": {
      "type": "Buffer",
      "data": [
        77,
        121,
        83,
        81,
        76,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "varbinary_column": {
      "type": "Buffer",
      "data": [
        72,
        101,
        108,
        108,
        111,
        32
      ]
    },
    "blob_column": {
      "type": "Buffer",
      "data": [
        98,
        105,
        110,
        97,
        114,
        121
      ]
    }
  }
]
[nodejs::only] Skipping test "testFindManyTypeTestPostgres" with flavor: mysql
[nodejs] resultDeleteMany {
  "count": 1
}
[nodejs] disconnecting...
[nodejs] disconnected
[nodejs] re-connecting...
[nodejs] re-connecting
[nodejs] re-disconnecting...
[nodejs] re-disconnected
[nodejs] closing database connection...
[nodejs] closed database connection
```

You can also observe more logs by specifying the environment variable `DEBUG="prisma:js-connector:planetscale"`.

Note: you used to be able to run these Prisma commands without changing the provider name, but [#4074](https://github.com/prisma/prisma-engines/pull/4074) changed that (see https://github.com/prisma/prisma-engines/pull/4074#issuecomment-1649942475).

### Neon

- Create a new database with Neon CLI `npx neonctl projects create` or in [Neon Console](https://neon.tech).
- Paste the connection string to `JS_NEON_DATABASE_URL`.

In the current directory:

- Run `pnpm prisma:neon` to push the Prisma schema, insert the test data, and generate the Prisma Client.
- Run `pnpm neon` to run smoke tests against the Neon database.

The latest command should display a similar output:

```bash
❯ pnpm neon

> js-connectors@1.0.0 neon /Users/jkomyno/work/prisma/prisma/reproductions/js-connectors
> ts-node ./src/neon.ts

[nodejs] connecting...
[nodejs] connected
[nodejs::only] Skipping test "testFindManyTypeTestMySQL" with flavor: postgres
thread 'tokio-runtime-worker' panicked at 'Expected a number, found Bool(true)', query-engine/js-connectors/src/proxy.rs:234:25
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
PrismaClientRustPanicError:
Invalid `this.prisma.type_test.findMany()` invocation in
/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/src/test.ts:98:51

  95
  96 @withFlavor({ only: ['postgres'] })
  97 private async testFindManyTypeTestPostgres() {
→ 98   const resultSet = await this.prisma.type_test.findMany(
Expected a number, found Bool(true)

This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

https://github.com/prisma/prisma/issues/new?body=Hi+Prisma+Team%21+My+Prisma+Client+just+crashed.+This+is+the+report%3A%0A%23%23+Versions%0A%0A%7C+Name++++++++++++%7C+Version++++++++++++%7C%0A%7C-----------------%7C--------------------%7C%0A%7C+Node++++++++++++%7C+v18.16.1+++++++++++%7C+%0A%7C+OS++++++++++++++%7C+darwin-arm64+++++++%7C%0A%7C+Prisma+Client+++%7C+0.0.0++++++++++++++%7C%0A%7C+Query+Engine++++%7C+ecb5e33339ea427464f728202402a5a832eec339%7C%0A%7C+Database++++++++%7C+%40prisma%2Fneon+++++++%7C%0A%0A%0A%0A%23%23+Logs%0A%60%60%60%0Aprisma%3AtryLoadEnv+Environment+variables+not+found+at+null%0Aprisma%3AtryLoadEnv+Environment+variables+not+found+at+undefined%0Aprisma%3AtryLoadEnv+No+Environment+variables+loaded%0Aprisma%3Aclient+checkPlatformCaching%3Apostinstall+false%0Aprisma%3Aclient+checkPlatformCaching%3AciName+%0Aprisma%3AtryLoadEnv+Environment+variables+not+found+at+null%0Aprisma%3AtryLoadEnv+Environment+variables+not+found+at+undefined%0Aprisma%3AtryLoadEnv+No+Environment+variables+loaded%0Aprisma%3Aclient+dirname+%2FUsers%2Fjkomyno%2Fwork%2Fprisma%2Fprisma%2Freproductions%2Fjs-connectors%2Fnode_modules%2F.prisma%2Fclient%0Aprisma%3Aclient+relativePath+..%2F..%2F..%2Fprisma%2Fpostgres-neon%0Aprisma%3Aclient+cwd+%2FUsers%2Fjkomyno%2Fwork%2Fprisma%2Fprisma%2Freproductions%2Fjs-connectors%2Fprisma%2Fpostgres-neon%0Aprisma%3Aclient+clientVersion+0.0.0%0Aprisma%3Aclient+clientEngineType+library%0Aprisma%3Aclient%3AlibraryEngine+internalSetup%0Aprisma%3Aclient%3AlibraryEngine+Using+jsConnector%3A+%25O+%7B%22flavor%22%3A%22postgres%22%7D%0Aprisma%3Aclient%3AlibraryEngine+library+starting%0Aprisma%3Aclient%3AlibraryEngine+library+started%0Aprisma%3Aclient%3AlibraryEngine+sending+request%2C+this.libraryStarted%3A+true%0Aprisma%3Aclient%3AlibraryEngine+data%40request+%25O+%7B%22errors%22%3A%5B%7B%22error%22%3A%22Expected+a+number%2C+found+Bool%28true%29%22%2C%22user_facing_error%22%3A%7B%22is_panic%22%3Atrue%2C%22message%22%3A%22Expected+a+number%2C+found+Bool%28true%29%22%2C%22backtrace%22%3Anull%7D%7D%5D%7D%0A%60%60%60%0A%0A%23%23+Client+Snippet%0A%60%60%60ts%0A%2F%2F+PLEASE+FILL+YOUR+CODE+SNIPPET+HERE%0A%60%60%60%0A%0A%23%23+Schema%0A%60%60%60prisma%0A%2F%2F+PLEASE+ADD+YOUR+SCHEMA+HERE+IF+POSSIBLE%0A%60%60%60%0A%0A%23%23+Prisma+Engine+Query%0A%60%60%60%0A%7B%22X%22%3Atrue%7D%7D%7D%0A%60%60%60%0A&title=Expected+a+number%2C+found+Bool%28true%29&template=bug_report.md

If you want the Prisma team to look into it, please open the link above 🙏
To increase the chance of success, please post your schema and a snippet of
how you used Prisma Client in the issue.

    at Hr.handleRequestError (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/node_modules/.prisma/client/runtime/library.js:122:7324)
    at Hr.handleAndLogRequestError (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/node_modules/.prisma/client/runtime/library.js:122:6388)
    at Hr.request (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/node_modules/.prisma/client/runtime/library.js:122:6108)
    at async l (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/node_modules/.prisma/client/runtime/library.js:126:10343)
    at async SmokeTest.testFindManyTypeTestPostgres (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/src/test.ts:98:23)
    at async SmokeTest.testFindManyTypeTest (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/src/test.ts:54:5)
    at async smokeTest (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/src/test.ts:22:3)
    at async neon (/Users/jkomyno/work/prisma/prisma/reproductions/js-connectors/src/neon.ts:11:3) {
  clientVersion: '0.0.0'
}
 ELIFECYCLE  Command failed with exit code 1.
```

`pnpm neon` will fail until https://github.com/prisma/prisma-engines/pull/4097 is merged and the corresponding engines are integrated in `prisma/prisma`.

You can also observe more logs by specifying the environment variable `DEBUG="prisma:js-connector:neon"`.

## How to use

In the current directory:

- Run `pnpm planetscale` to run smoke tests against the PlanetScale database
- Run `pnpm neon` to run smoke tests against the PlanetScale database
