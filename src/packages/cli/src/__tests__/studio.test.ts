import fs from 'fs'
import http from 'http'
import path from 'path'
import fetch from 'node-fetch'
import rimraf from 'rimraf'

import { Studio } from '../Studio'

const STUDIO_TEST_PORT = 5678

// silencium
console.log = () => null

const sendRequest = (message: any): Promise<any> => {
  return fetch(`http://127.0.0.1:${STUDIO_TEST_PORT}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
}

let studio: Studio

beforeEach(async () => {
  // Before  every test, we'd like to reset the DB.
  // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
  rimraf.sync(path.join(__dirname, './fixtures/studio-test-project/dev_tmp.db'))
  fs.copyFileSync(
    path.join(__dirname, './fixtures/studio-test-project/dev.db'),
    path.join(__dirname, './fixtures/studio-test-project/dev_tmp.db'),
  )

  // Clean up Client generation directory
  rimraf.sync(path.join(__dirname, '../prisma-client'))
  studio = Studio.new({
    // providerAliases
    'prisma-client-js': {
      generatorPath: `node --max-old-space-size=8096 "${path.join(
        __dirname,
        '../../../client/generator-build/index.js',
      )}"`,
      outputPath: path.join(__dirname, '../prisma-client/'),
    },
  })

  await studio.parse([
    '--schema',
    path.join(__dirname, './fixtures/studio-test-project/schema.prisma'),
    '--port',
    `${STUDIO_TEST_PORT}`,
    '--browser',
    'none',
  ])

  await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientStart',
    payload: {},
  })
})

afterEach(async () => {
  await studio.instance?.stop()
})

it('launches client correctly', async () => {
  await new Promise<void>((res, rej) => {
    http.get(`http://localhost:${STUDIO_TEST_PORT}`, (response) => {
      try {
        expect(response.statusCode).toEqual(200)
        res()
      } catch (e) {
        rej(e)
      }
    })
  })
})

it('can respond to `findMany` queries', async () => {
  const res = await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientRequest',
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

  expect(res).toMatchSnapshot()
})

it('can respond to `create` queries', async () => {
  const res = await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientRequest',
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

  expect(res).toMatchSnapshot()
})

it('can respond to `update` queries', async () => {
  const res = await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientRequest',
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

  expect(res).toMatchSnapshot()
})

it('can respond to `delete` queries', async () => {
  const res = await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientRequest',
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

  expect(res).toMatchSnapshot()
})
