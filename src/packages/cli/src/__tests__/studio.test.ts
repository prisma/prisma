import fs from 'fs'
import fetch from 'node-fetch'
import execa, { ExecaChildProcess } from 'execa'
import path from 'path'
import rimraf from 'rimraf'

const STUDIO_TEST_PORT = 5678
const schemaHash = 'e1b6a1a8d633d83d0cb7db993af86f17'

async function sendRequest(message: any): Promise<any> {
  return fetch(`http://127.0.0.1:${STUDIO_TEST_PORT}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  }).then((res) => res.json())
}

let studio: ExecaChildProcess

beforeAll(async () => {
  try {
    await execa('pnpm', ['run', 'build'])
  } catch (e) {
    // Ignore warnings & errors. If they occur, tests will fail anyway
  }
})

beforeEach(async () => {
  process.env.PRISMA_FORCE_NAPI = ''

  // Before every test, we'd like to reset the DB.
  // We do this by duplicating the original SQLite DB file, and using the duplicate as the datasource in our schema
  rimraf.sync(path.join(__dirname, './fixtures/studio-test-project/dev_tmp.db'))
  fs.copyFileSync(
    path.join(__dirname, './fixtures/studio-test-project/dev.db'),
    path.join(__dirname, './fixtures/studio-test-project/dev_tmp.db'),
  )

  // Start Studio
  studio = execa('node', [
    './build/index.js',
    'studio',
    `--schema=${path.join(
      __dirname,
      './fixtures/studio-test-project/schema.prisma',
    )}`,
    `--port=${STUDIO_TEST_PORT}`,
    '--browser=none',
  ])

  // Uncomment to debug
  // studio.stdout?.on('data', (d) => d.toString())

  await new Promise((r) => setTimeout(() => r(null), 2000))
})

afterEach(async () => {
  await studio.kill()
})

it('can start up correctly', async () => {
  const res = await fetch(`http://localhost:${STUDIO_TEST_PORT}`)
  expect(res.status).toEqual(200)
})

it('can respond to `findMany` queries', async () => {
  const res = await sendRequest({
    requestId: 1,
    channel: 'prisma',
    action: 'clientRequest',
    payload: {
      data: {
        schemaHash,
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
        schemaHash,
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
        schemaHash,
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
        schemaHash,
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
