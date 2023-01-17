import { jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import rimraf from 'rimraf'

import { Studio } from '../../Studio'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const STUDIO_TEST_PORT = 5678

function sendRequest(message: any): Promise<any> {
  return fetch(`http://localhost:${STUDIO_TEST_PORT}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(message),
  }).then((res) => res.json())
}

let studio: Studio

describe('Studio CLI', () => {
  it('should fail if url is prisma://', async () => {
    ctx.fixture('schema-only-data-proxy')

    const result = Studio.new().parse([])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      Using the Data Proxy (connection URL starting with protocol prisma://) is not supported for this CLI command prisma studio yet.

      More information about Data Proxy: https://pris.ly/d/data-proxy-cli

    `)
  })
})

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

    await studio.parse([
      '--schema',
      path.join(__dirname, '../fixtures/studio-test-project/schema.prisma'),
      '--port',
      `${STUDIO_TEST_PORT}`,
      '--browser',
      'none',
    ])

    // Give Studio time to start
    await new Promise((r) => setTimeout(() => r(null), 2000))
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

    await studio.parse([
      '--schema',
      path.join(__dirname, '../fixtures/studio-test-project-custom-filename/schema1.prisma'),
      '--port',
      `${STUDIO_TEST_PORT}`,
      '--browser',
      'none',
    ])

    // Give Studio time to start
    await new Promise((r) => setTimeout(() => r(null), 2000))
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
