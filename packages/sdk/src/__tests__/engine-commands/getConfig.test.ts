import stripAnsi from 'strip-ansi'

import { getConfig } from '../..'

describe('getConfig', () => {
  test('empty config', async () => {
    const config = await getConfig({
      datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }
      
      model A {
        id Int @id
        name String
      }`,
    })

    expect(config.datasources).toHaveLength(1)
    expect(config.datasources[0].provider).toEqual('sqlite')
    expect(config.generators).toHaveLength(0)
    expect(config.warnings).toHaveLength(0)
    expect(config).toMatchSnapshot()
  })

  test('sqlite and createMany', async () => {
    expect.assertions(1)
    try {
      const config = await getConfig({
        datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }

      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["createMany"]
      }
      
      model A {
        id Int @id
        name String
      }`,
      })
      console.log('config @ sqlite and createMany', config)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "Get config: Database provider \\"sqlite\\" and the preview feature \\"createMany\\" can't be used at the same time.
          Please either remove the \\"createMany\\" feature flag or use any other database type that Prisma supports: postgres, mysql or sqlserver."
      `)
    }
  })

  test('with generator and datasource', async () => {
    const config = await getConfig({
      datamodel: `
    datasource db {
      url = "file:dev.db"
      provider = "sqlite"
    }

    generator gen {
      provider = "fancy-provider"
      binaryTargets = ["native"]
    }

    model A {
      id Int @id
      name String
    }`,
    })

    expect(config.datasources).toHaveLength(1)
    expect(config.generators).toHaveLength(1)
    expect(config.warnings).toHaveLength(0)
    expect(config).toMatchSnapshot()
  })

  test('datasource with env var', async () => {
    process.env.TEST_POSTGRES_URI_FOR_DATASOURCE = 'postgres://user:password@something:5432/db'

    const config = await getConfig({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("TEST_POSTGRES_URI_FOR_DATASOURCE")
      }
      `,
    })

    expect(config).toMatchSnapshot()
  })

  test('datasource with env var - ignoreEnvVarErrors', async () => {
    const config = await getConfig({
      ignoreEnvVarErrors: true,
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("SOMETHING-SOMETHING-1234")
      }
      `,
    })

    expect(config).toMatchSnapshot()
  })
  test('with engineType="binary"', async () => {
    const binaryConfig = await getConfig({
      datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }

      generator gen {
        provider = "fancy-provider"
        engineType = "binary"
      }

      model A {
        id Int @id
        name String
      }`,
    })

    expect(binaryConfig).toMatchInlineSnapshot(`
Object {
  "datasources": Array [
    Object {
      "activeProvider": "sqlite",
      "name": "db",
      "provider": "sqlite",
      "url": Object {
        "fromEnvVar": null,
        "value": "file:../hello.db",
      },
    },
  ],
  "generators": Array [
    Object {
      "binaryTargets": Array [],
      "config": Object {
        "engineType": "binary",
      },
      "name": "gen",
      "output": null,
      "previewFeatures": Array [],
      "provider": Object {
        "fromEnvVar": null,
        "value": "fancy-provider",
      },
    },
  ],
  "warnings": Array [],
}
`)
  })
  test('with engineType="library"', async () => {
    const libraryConfig = await getConfig({
      datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }

      generator gen {
        provider = "fancy-provider"
        engineType = "library"
      }

      model A {
        id Int @id
        name String
      }`,
    })

    expect(libraryConfig).toMatchInlineSnapshot(`
Object {
  "datasources": Array [
    Object {
      "activeProvider": "sqlite",
      "name": "db",
      "provider": "sqlite",
      "url": Object {
        "fromEnvVar": null,
        "value": "file:../hello.db",
      },
    },
  ],
  "generators": Array [
    Object {
      "binaryTargets": Array [],
      "config": Object {
        "engineType": "library",
      },
      "name": "gen",
      "output": null,
      "previewFeatures": Array [],
      "provider": Object {
        "fromEnvVar": null,
        "value": "fancy-provider",
      },
    },
  ],
  "warnings": Array [],
}
`)
  })
})
