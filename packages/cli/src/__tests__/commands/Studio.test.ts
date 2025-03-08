import { defaultTestConfig, type PrismaConfigInternal } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import * as miniProxy from '@prisma/mini-proxy'
import fs from 'node:fs'
import fetch from 'node-fetch'
import path from 'node:path'
import rimraf from 'rimraf'

import { DbPush } from '../../../../migrate/src/commands/DbPush'
import { Studio } from '../../Studio'

const originalEnv = { ...process.env }

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const STUDIO_TEST_PORT = 5678

const testIf = (condition: boolean) => (condition ? test : test.skip)
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// biome-ignore lint/suspicious/noExplicitAny: Using any for test flexibility
async function sendRequest(message: any): Promise<any> {
  const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(message),
  })

  return res.json()
}

let studio: Studio
// Prisma Studio ignores env vars for overriding engine paths, skipping test for now
describeIf(!process.env.PRISMA_QUERY_ENGINE_LIBRARY && !process.env.PRISMA_QUERY_ENGINE_BINARY)(
  'studio with alternative urls and prisma://',
  () => {
    afterEach(() => {
      // Back to original env vars
      process.env = { ...originalEnv }
    })

    test('queries work if url is prisma:// and directUrl is set', async () => {
      process.env.PDP_URL = 'prisma://aws-us-east-1.prisma-data.com/?api_key=MY_API_KEY'
      process.env.DATABASE_URL = process.env.TEST_POSTGRES_URI!.replace('tests', `tests-${Date.now()}-studio`)

      ctx.fixture('schema-only-data-proxy-direct-url')

      const studio = Studio.new()

      await DbPush.new().parse(['--schema', 'schema.prisma', '--skip-generate'], defaultTestConfig())
      const result = studio.parse(['--port', `${STUDIO_TEST_PORT}`, '--browser', 'none'], defaultTestConfig())

      await expect(result).resolves.not.toThrow()

      const res = await sendRequest({
        requestId: 1,
        channel: 'prisma',
        action: 'clientRequest',
        payload: {
          data: {
            modelName: 'SomeUser',
            operation: 'findMany',
            args: {
              select: {
                id: true,
              },
            },
          },
        },
      })

      expect(res).toMatchSnapshot()

      studio.instance?.stop()
    })

    testIf(process.platform !== 'win32')('queries work if url is prisma:// via the mini-proxy', async () => {
      process.env.DATABASE_URL = process.env.TEST_POSTGRES_URI!.replace('tests', `tests-${Date.now()}-studio`)
      process.env.PDP_URL = miniProxy.generateConnectionString({
        envVar: 'PDP_URL',
        databaseUrl: process.env.DATABASE_URL,
        port: miniProxy.defaultServerConfig.port,
      })

      ctx.fixture('schema-only-data-proxy')

      await DbPush.new().parse(['--schema', 'schema.prisma', '--skip-generate'], defaultTestConfig())
      process.env.DATABASE_URL = undefined

      const studio = Studio.new()
      const result = studio.parse(['--port', `${STUDIO_TEST_PORT}`, '--browser', 'none'], defaultTestConfig())

      await expect(result).resolves.not.toThrow()

      const res = await sendRequest({
        requestId: 1,
        channel: 'prisma',
        action: 'clientRequest',
        payload: {
          data: {
            modelName: 'SomeUser',
            operation: 'findMany',
            args: {
              select: {
                id: true,
              },
            },
          },
        },
      })

      expect(res).toMatchSnapshot()

      studio.instance?.stop()

      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })
  },
)

describe('studio with default schema.prisma filename', () => {
  jest.setTimeout(20_000)

  beforeAll(async () => {
    // Before every test, we'd like to reset the DB.
    // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
    rimraf.sync(path.join(__dirname, '../fixtures/studio-test-project/dev_tmp.db'))
    fs.copyFileSync(
      path.join(__dirname, '../fixtures/studio-test-project/dev.db'),
      path.join(__dirname, '../fixtures/studio-test-project/dev_tmp.db'),
    )

    // Clean up Client generation directory
    rimraf.sync(path.join(__dirname, '../prisma-client'))
    studio = Studio.new()

    await studio.parse(
      [
        '--schema',
        path.join(__dirname, '../fixtures/studio-test-project/schema.prisma'),
        '--port',
        `${STUDIO_TEST_PORT}`,
        '--browser',
        'none',
      ],
      defaultTestConfig(),
    )

    // Give Studio time to start
    await new Promise((r) => setTimeout(() => r(null), 2_000))
  })

  afterAll(() => {
    studio.instance!.stop()
  })

  test('can start up correctly', async () => {
    const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}`)
    expect(res.status).toEqual(200)
  })

  test('can respond to `findMany` queries', async () => {
    const res = await sendRequest({
      requestId: 1,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'findMany',
          args: {
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `create` queries', async () => {
    const res = await sendRequest({
      requestId: 2,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'create',
          args: {
            data: {
              id: 3,
              string: '',
              int: 0,
              float: 0.0,
              datetime: '2020-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `update` queries', async () => {
    const res = await sendRequest({
      requestId: 3,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'update',
          args: {
            where: {
              id: 1,
            },
            data: {
              string: 'Changed String',
              int: 100,
              float: 100.5,
              datetime: '2025-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `delete` queries', async () => {
    const res = await sendRequest({
      requestId: 4,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'delete',
          args: {
            where: { id: 2 },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })
    expect(res).toMatchSnapshot()
  })
})

describe('studio with custom schema.prisma filename', () => {
  jest.setTimeout(20_000)

  beforeAll(async () => {
    // Before every test, we'd like to reset the DB.
    // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
    rimraf.sync(path.join(__dirname, '../fixtures/studio-test-project-custom-filename/dev_tmp.db'))
    fs.copyFileSync(
      path.join(__dirname, '../fixtures/studio-test-project-custom-filename/dev.db'),
      path.join(__dirname, '../fixtures/studio-test-project-custom-filename/dev_tmp.db'),
    )

    // Clean up Client generation directory
    rimraf.sync(path.join(__dirname, '../prisma-client'))
    studio = Studio.new()

    await studio.parse(
      [
        '--schema',
        path.join(__dirname, '../fixtures/studio-test-project-custom-filename/schema1.prisma'),
        '--port',
        `${STUDIO_TEST_PORT}`,
        '--browser',
        'none',
      ],
      defaultTestConfig(),
    )

    // Give Studio time to start
    await new Promise((r) => setTimeout(() => r(null), 2_000))
  })

  afterAll(() => {
    studio.instance!.stop()
  })

  test('can start up correctly', async () => {
    const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}`)
    expect(res.status).toEqual(200)
  })

  test('can respond to `findMany` queries', async () => {
    const res = await sendRequest({
      requestId: 1,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'findMany',
          args: {
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `create` queries', async () => {
    const res = await sendRequest({
      requestId: 2,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'create',
          args: {
            data: {
              id: 3,
              string: '',
              int: 0,
              float: 0.0,
              datetime: '2020-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `update` queries', async () => {
    const res = await sendRequest({
      requestId: 3,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'update',
          args: {
            where: {
              id: 1,
            },
            data: {
              string: 'Changed String',
              int: 100,
              float: 100.5,
              datetime: '2025-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `delete` queries', async () => {
    const res = await sendRequest({
      requestId: 4,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'delete',
          args: {
            where: { id: 2 },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })
    expect(res).toMatchSnapshot()
  })
})

describeIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')('studio with schema folder', () => {
  jest.setTimeout(20_000)

  beforeAll(async () => {
    // Before every test, we'd like to reset the DB.
    // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
    rimraf.sync(path.join(__dirname, '../fixtures/studio-test-project-schema-folder/dev_tmp.db'))
    fs.copyFileSync(
      path.join(__dirname, '../fixtures/studio-test-project-schema-folder/dev.db'),
      path.join(__dirname, '../fixtures/studio-test-project-schema-folder/dev_tmp.db'),
    )

    // Clean up Client generation directory
    rimraf.sync(path.join(__dirname, '../prisma-client'))
    studio = Studio.new()

    await studio.parse(
      [
        '--schema',
        path.join(__dirname, '../fixtures/studio-test-project-schema-folder/schema'),
        '--port',
        `${STUDIO_TEST_PORT}`,
        '--browser',
        'none',
      ],
      defaultTestConfig(),
    )

    // Give Studio time to start
    await new Promise((r) => setTimeout(() => r(null), 2_000))
  })

  afterAll(() => {
    studio.instance!.stop()
  })

  test('can start up correctly', async () => {
    const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}`)
    expect(res.status).toEqual(200)
  })

  test('can respond to `findMany` queries', async () => {
    const res = await sendRequest({
      requestId: 1,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'findMany',
          args: {
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `create` queries', async () => {
    const res = await sendRequest({
      requestId: 2,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'create',
          args: {
            data: {
              id: 3,
              string: '',
              int: 0,
              float: 0.0,
              datetime: '2020-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `update` queries', async () => {
    const res = await sendRequest({
      requestId: 3,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'update',
          args: {
            where: {
              id: 1,
            },
            data: {
              string: 'Changed String',
              int: 100,
              float: 100.5,
              datetime: '2025-08-03T00:00:00.000Z',
              relation: {
                connect: {
                  id: 3,
                },
              },
              relation_list: {
                connect: {
                  id: 3,
                },
              },
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })

    expect(res).toMatchSnapshot()
  })

  test('can respond to `delete` queries', async () => {
    const res = await sendRequest({
      requestId: 4,
      channel: 'prisma',
      action: 'clientRequest',
      payload: {
        data: {
          modelName: 'with_all_field_types',
          operation: 'delete',
          args: {
            where: { id: 2 },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            },
          },
        },
      },
    })
    expect(res).toMatchSnapshot()
  })
})

describeIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')(
  'studio with driver adapter from prisma.config.ts',
  () => {
    jest.setTimeout(20_000)

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    beforeAll(async () => {
      // Before every test, we'd like to reset the DB.
      // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
      rimraf.sync(path.join(__dirname, '../fixtures/studio-test-project-driver-adapter/dev_tmp.db'))
      fs.copyFileSync(
        path.join(__dirname, '../fixtures/studio-test-project-driver-adapter/dev.db'),
        path.join(__dirname, '../fixtures/studio-test-project-driver-adapter/dev_tmp.db'),
      )

      // Clean up Client generation directory
      rimraf.sync(path.join(__dirname, '../prisma-client'))
      studio = Studio.new()

      const config = (
        await import(path.join(__dirname, '../fixtures/studio-test-project-driver-adapter/prisma.config.ts'))
      ).default as PrismaConfigInternal

      await studio.parse(['--port', `${STUDIO_TEST_PORT}`, '--browser', 'none'], config)

      // Give Studio time to start
      await new Promise((r) => setTimeout(() => r(null), 2_000))
    })

    afterAll(() => {
      studio.instance!.stop()
    })

    test('starts up correctly', async () => {
      const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}`)
      expect(res.status).toEqual(200)
    })

    test('responds to `findMany` queries', async () => {
      const res = await sendRequest({
        requestId: 1,
        channel: 'prisma',
        action: 'clientRequest',
        payload: {
          data: {
            modelName: 'with_all_field_types',
            operation: 'findMany',
            args: {
              select: {
                id: true,
                string: true,
                int: true,
                float: true,
                relation: true,
                relation_list: true,
              },
            },
          },
        },
      })

      expect(res).toMatchSnapshot()
    })
  },
)
