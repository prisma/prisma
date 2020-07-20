import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import http from 'http'
import assert from 'assert'
import del from 'del'
import mkdir from 'make-dir'
import pkgup from 'pkg-up'

import { Studio } from '../Studio'

const writeFile = promisify(fs.writeFile)

describe('Studio', () => {
  let testRootDir
  let studioInstance

  beforeAll(async () => {
    const pkg = path.dirname((await pkgup({ cwd: __dirname })) || __filename)
    testRootDir = path.resolve(`${pkg}/tmp/studio-${Date.now()}`)

    await mkdir(testRootDir)
    await writeFile(
      path.resolve(`${testRootDir}/schema.prisma`),
      `
      datasource my_db {
        provider = "sqlite"
        url = "file:./db/db_file.db"
        default = true
      }

      model User {
        id Int @id
      }
    `,
    )
    // For the time being, it is okay that the SQLite file used in this schema doesn't exist
    // This is because the test only sees if Studio loads, and not that data is shown correctly (for now)
  })

  beforeEach(() => {
    studioInstance = new Studio({
      schemaPath: path.resolve(`${testRootDir}/schema.prisma`),
      staticAssetDir: path.resolve('../../build/public'),
      port: 5678,
      browser: 'none',
    })
  })

  afterEach(() => {
    studioInstance = null
  })

  afterAll(async () => {
    await del(testRootDir)
  })

  test('launches', async (done) => {
    await studioInstance.start()

    http.get('http://localhost:5678', (res) => {
      assert.ok(res.statusCode === 200, 'Studio did not launch correctly')
      done()
    })
  })
})
