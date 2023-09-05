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
JsConnector::is_provider(@prisma/neon) == true
[nodejs] connected
[nodejs] children []
[nodejs] totalChildren 0
[nodejs::only] Skipping test "testFindManyTypeTestMySQL" with flavor: undefined
[nodejs::only] Skipping test "testFindManyTypeTestPostgres" with flavor: undefined
[nodejs] resultDeleteMany {
  "count": 1
}
[nodejs] disconnecting...
[nodejs] disconnected
[nodejs] re-connecting...
JsConnector::is_provider(@prisma/neon) == true
[nodejs] re-connecting
[nodejs] re-disconnecting...
[nodejs] re-disconnected
[nodejs] closing database connection...
[nodejs] closed database connection
```

`pnpm neon` will fail until https://github.com/prisma/prisma-engines/pull/4097 is merged and the corresponding engines are integrated in `prisma/prisma`.

You can also observe more logs by specifying the environment variable `DEBUG="prisma:js-connector:neon"`.

## How to use

In the current directory:

- Run `pnpm planetscale` to run smoke tests against the PlanetScale database
- Run `pnpm neon` to run smoke tests against the PlanetScale database
