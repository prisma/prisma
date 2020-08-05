import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import http from 'http'
import tempy from 'tempy'
import del from 'del'
import mkdir from 'make-dir'
import WebSocket from 'ws'

import { Studio } from '../Studio'

const writeFile = promisify(fs.writeFile)
const testRootDir = tempy.directory()
const STUDIO_TEST_PORT = 5678

const setupWS = (): Promise<WebSocket> => {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${STUDIO_TEST_PORT}/`)
    ws.on('open', () => {
      ws.on('message', (data: string) => {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
        const message: any = JSON.parse(data)

        expect(message).toHaveProperty('channel')
        expect(message).toHaveProperty('action')

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

      expect(message).toHaveProperty('channel')
      expect(message).toHaveProperty('action')

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

jest.setTimeout(10000) // Increase timeout for all tests & hooks

describe('Studio', () => {
  let studioInstance: Studio
  let ws: WebSocket

  beforeEach(async () => {
    await mkdir(testRootDir)
    await writeFile(
      path.resolve(`${testRootDir}/schema.prisma`),
      `
      datasource my_db {
        provider = "sqlite"
        url      = "file:./studio-test.db"
      }

      model with_all_field_types {
        id       Int      @id
        string   String
        int      Int
        float    Float
        datetime DateTime
      
        relation      relation_target   @relation("waft_rt")
        relation_list relation_target[] @relation("waft_rt_list")
      }
      
      model relation_target {
        id   Int    @id
        name String
      
        // waft = With All Field Types
        waft_id Int?
        waft    with_all_field_types?  @relation("waft_rt", fields: [waft_id], references: [id])
        wafts   with_all_field_types[] @relation("waft_rt_list", fields: [waft_id], references: [id])
      }
    `,
    )
    fs.copyFileSync(
      './src/__tests__/studio-test.db',
      path.resolve(`${testRootDir}/studio-test.db`),
    )
    studioInstance = new Studio({
      schemaPath: path.resolve(`${testRootDir}/schema.prisma`),
      staticAssetDir: path.resolve(__dirname, '../../../cli/build/public'),
      port: STUDIO_TEST_PORT,
      browser: 'none',
    })

    await studioInstance.start({})

    ws = await setupWS()
  })

  afterEach(async () => {
    await studioInstance.stop()
    await del(testRootDir, { force: true }) // Need force: true because `del` does not delete dirs outside the CWD
    ws.close()
  })

  test('launches client correctly', async () => {
    await new Promise((res) => {
      http.get(`http://localhost:${STUDIO_TEST_PORT}`, (response) => {
        expect(response.statusCode).toBe(200)
        res()
      })
    })
  })

  test('can respond to `findMany` queries', async () => {
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

    expect(response).toHaveProperty('payload')

    expect(response.payload).toHaveProperty('error', null)

    expect(response.payload).toHaveProperty('data')
    expect(response.payload.data).toHaveProperty('params')
    expect(response.payload.data.params).toHaveProperty(
      'model',
      'with_all_field_types',
    )
    expect(response.payload.data.params).toHaveProperty('args')
    expect(response.payload.data.params.args).toHaveProperty('select', {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    expect(response.payload.data).toHaveProperty('response', [
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

  test('can respond to `create` queries', async () => {
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

    expect(response).toHaveProperty('payload')

    expect(response.payload).toHaveProperty('error', null)

    expect(response.payload).toHaveProperty('data')
    expect(response.payload.data).toHaveProperty('params')
    expect(response.payload.data.params).toHaveProperty(
      'model',
      'with_all_field_types',
    )
    expect(response.payload.data.params).toHaveProperty('args')
    expect(response.payload.data.params.args).toHaveProperty('select', {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    expect(response.payload.data).toHaveProperty('response', {
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

  test('can respond to `update` queries', async () => {
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

    expect(response).toHaveProperty('payload')

    expect(response.payload).toHaveProperty('error', null)

    expect(response.payload).toHaveProperty('data')
    expect(response.payload.data).toHaveProperty('params')
    expect(response.payload.data.params).toHaveProperty(
      'model',
      'with_all_field_types',
    )
    expect(response.payload.data.params).toHaveProperty('args')
    expect(response.payload.data.params.args).toHaveProperty('select', {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    expect(response.payload.data).toHaveProperty('response', {
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

  test('can respond to `delete` queries', async () => {
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

    expect(response).toHaveProperty('payload')

    expect(response.payload).toHaveProperty('error', null)

    expect(response.payload).toHaveProperty('data')
    expect(response.payload.data).toHaveProperty('params')
    expect(response.payload.data.params).toHaveProperty(
      'model',
      'with_all_field_types',
    )
    expect(response.payload.data.params).toHaveProperty('args')
    expect(response.payload.data.params.args).toHaveProperty('select', {
      id: true,
      string: true,
      int: true,
      float: true,
      datetime: true,
      relation: true,
      relation_list: true,
    })

    expect(response.payload.data).toHaveProperty('response', {
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
