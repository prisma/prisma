import fs from 'fs'
import path from 'path'
import http from 'http'
import assert from 'assert'
import WebSocket from 'ws'
import { Studio } from '../Studio'

const STUDIO_TEST_PORT = 5678

const setupWS = (): Promise<WebSocket> => {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${STUDIO_TEST_PORT}/`)
    ws.on('open', () => {
      ws.on('message', (data: string) => {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
        const message: any = JSON.parse(data)

        assert.ok(message.channel !== undefined)
        assert.ok(message.action !== undefined)

        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        if (message.channel !== '-photon' && message.action !== 'start') {
          return
        }
        /* eslint-enable */

        res(ws)
      })

      ws.send(
        JSON.stringify({
          requestId: 1,
          channel: 'photon',
          action: 'start',
          payload: {},
        }),
      )
    })
  })
}

const sendRequest = (ws: WebSocket, message: any): Promise<any> => {
  return new Promise((res) => {
    ws.on('message', (data: string) => {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const message: any = JSON.parse(data)

      assert.ok(message.channel !== undefined)
      assert.ok(message.action !== undefined)

      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      if (message.channel !== '-photon' && message.action !== 'request') {
        return
      }
      /* eslint-enable */

      res(message)
    })

    // Send the same query Studio would send if launched
    ws.send(JSON.stringify(message))
  })
}

describe('Studio', () => {
  let studio: Studio
  let ws: WebSocket

  beforeEach(async () => {
    // Before  every test, we'd like to reset the DB.
    // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
    fs.copyFileSync(
      './src/__tests__/fixtures/studio-test-project/dev.db',
      './src/__tests__/fixtures/studio-test-project/dev_tmp.db',
    )
    studio = Studio.new({
      'prisma-client-js': {
        generatorPath: `node --max-old-space-size=8096 "${path.resolve(
          './prisma-client/generator-build/index.js',
        )}"`, // all evals are here for ncc
        outputPath: eval(
          `require('path').join(__dirname, '../prisma-client/')`,
        ),
      },
    })

    await studio.parse([
      '--schema',
      path.resolve(
        './src/__tests__/fixtures/studio-test-project/schema.prisma',
      ),
      '--port',
      `${STUDIO_TEST_PORT}`,
      '--browser',
      'none',
    ])

    ws = await setupWS()
  })

  afterEach(async () => {
    await studio.instance?.stop()
    ws.close()
  })

  it('launches client correctly', async () => {
    await new Promise((res, rej) => {
      http.get(`http://localhost:${STUDIO_TEST_PORT}`, (response) => {
        try {
          assert.equal(response.statusCode, 200)
          res()
        } catch (e) {
          rej(e)
        }
      })
    })
  })

  it('can respond to `findMany` queries', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */

    // Send the same query Studio client would send if launched
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    const response = await sendRequest(ws, {
      requestId: 1,
      channel: 'photon',
      action: 'request',
      payload: {
        data: {
          query: `
          prisma.with_all_field_types.findMany({
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            }
          })`,
        },
      },
    })

    assert.ok(response.payload !== undefined)

    assert.strictEqual(response.payload.error, null)

    assert.ok(response.payload.data !== undefined)
    assert.ok(response.payload.data.params !== undefined)
    assert.ok(response.payload.data.params.model !== undefined)
    assert.strictEqual(
      response.payload.data.params.model,
      'with_all_field_types',
    )
    assert.ok(response.payload.data.params.args !== undefined)
    assert.deepStrictEqual(response.payload.data.params.args.select, {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    assert.ok(response.payload.data.response !== undefined)
    assert.deepStrictEqual(response.payload.data.response, [
      {
        id: 1,
        string: 'Some string',
        int: 42,
        float: 3.14,
        datetime: '2020-08-03T00:00:00.000Z',
        relation: { id: 1, name: 'Relation Target 001', waft_id: 1 },
        relation_list: [],
      },
      {
        id: 2,
        string: 'Delete me',
        int: 0,
        float: 0,
        datetime: '1970-01-01T00:00:00.000Z',
        relation: { id: 2, name: 'Relation Target 002', waft_id: 2 },
        relation_list: [],
      },
    ])
    /* eslint-enable */
  })

  it('can respond to `create` queries', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */

    // Send the same query Studio client would send if a new record was created
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    const response: any = await sendRequest(ws, {
      requestId: 1,
      channel: 'photon',
      action: 'request',
      payload: {
        data: {
          query: `
          prisma.with_all_field_types.create({
            data: {
              id: 3,
              string: "",
              int: 0,
              float: 0.0,
              datetime: "2020-08-03T00:00:00.000Z",
              relation: {
                connect: {
                  id: 3
                }
              },
              relation_list: {
                connect: {
                  id: 3
                }
              }
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            }
          })`,
        },
      },
    })

    assert.ok(response.payload !== undefined)

    assert.strictEqual(response.payload.error, null)

    assert.ok(response.payload.data !== undefined)
    assert.ok(response.payload.data.params !== undefined)
    assert.ok(response.payload.data.params.model !== undefined)
    assert.strictEqual(
      response.payload.data.params.model,
      'with_all_field_types',
    )
    assert.ok(response.payload.data.params.args !== undefined)
    assert.deepStrictEqual(response.payload.data.params.args.select, {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    assert.ok(response.payload.data.response !== undefined)
    assert.deepStrictEqual(response.payload.data.response, {
      id: 3,
      string: '',
      int: 0,
      float: 0,
      datetime: '2020-08-03T00:00:00.000Z',
      relation: { id: 3, name: 'Relation Target 003', waft_id: 3 },
      relation_list: [{ id: 3, name: 'Relation Target 003', waft_id: 3 }],
    })
    /* eslint-enable */
  })

  it('can respond to `update` queries', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */

    // Send the same query Studio client would send if a new record was created
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    const response: any = await sendRequest(ws, {
      requestId: 1,
      channel: 'photon',
      action: 'request',
      payload: {
        data: {
          query: `
          prisma.with_all_field_types.update({
            where: {
              id: 1
            },
            data: {
              string: "Changed String",
              int: 100,
              float: 100.5,
              datetime: "2025-08-03T00:00:00.000Z",
              relation: {
                connect: {
                  id: 3
                }
              },
              relation_list: {
                connect: {
                  id: 3
                }
              }
            },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            }
          })`,
        },
      },
    })

    assert.ok(response.payload !== undefined)

    assert.strictEqual(response.payload.error, null)

    assert.ok(response.payload.data !== undefined)
    assert.ok(response.payload.data.params !== undefined)
    assert.ok(response.payload.data.params.model !== undefined)
    assert.strictEqual(
      response.payload.data.params.model,
      'with_all_field_types',
    )
    assert.ok(response.payload.data.params.args !== undefined)
    assert.deepStrictEqual(response.payload.data.params.args.select, {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    assert.ok(response.payload.data.response !== undefined)
    assert.deepStrictEqual(response.payload.data.response, {
      id: 1,
      string: 'Changed String',
      int: 100,
      float: 100.5,
      datetime: '2025-08-03T00:00:00.000Z',
      relation: { id: 3, name: 'Relation Target 003', waft_id: 1 },
      relation_list: [{ id: 3, name: 'Relation Target 003', waft_id: 1 }],
    })
    /* eslint-enable */
  })

  it('can respond to `delete` queries', async () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */

    // Send the same query Studio client would send if an existing record was deleted
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    const response: any = await sendRequest(ws, {
      requestId: 1,
      channel: 'photon',
      action: 'request',
      payload: {
        data: {
          query: `
          prisma.with_all_field_types.delete({
            where: { id: 2 },
            select: {
              id: true,
              string: true,
              int: true,
              float: true,
              datetime: true,
              relation: true,
              relation_list: true,
            }
          })`,
        },
      },
    })

    assert.ok(response.payload !== undefined)

    assert.strictEqual(response.payload.error, null)

    assert.ok(response.payload.data !== undefined)
    assert.ok(response.payload.data.params !== undefined)
    assert.ok(response.payload.data.params.model !== undefined)
    assert.strictEqual(
      response.payload.data.params.model,
      'with_all_field_types',
    )
    assert.ok(response.payload.data.params.args !== undefined)
    assert.deepStrictEqual(response.payload.data.params.args.select, {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    assert.ok(response.payload.data.response !== undefined)
    assert.deepStrictEqual(response.payload.data.response, {
      id: 2,
      string: 'Delete me',
      int: 0,
      float: 0,
      datetime: '1970-01-01T00:00:00.000Z',
      relation: { id: 2, name: 'Relation Target 002', waft_id: 2 },
      relation_list: [],
    })
    /* eslint-enable */
  })
})
