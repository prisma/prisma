import tempy from 'tempy'
import path from 'path'
import { Doctor } from '../Doctor'
import copy from '@apexearth/copy'
import assert from 'assert'
import stripAnsi from 'strip-ansi'

describe('doctor', () => {
  it('doctor should succeed when schema and db match', async () => {
    const tmpDir = tempy.directory()
    await copy({
      from: path.join(__dirname, 'fixtures/example-project/prisma'),
      to: tmpDir,
      recursive: true,
    })
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const doctor = Doctor.new()
    const errLog = []
    const oldConsoleError = console.error
    console.error = (...args) => {
      errLog.push(...args)
    }
    const result = await doctor.parse([])
    console.error = oldConsoleError

    assert.deepEqual(errLog, [`👩‍⚕️🏥 Prisma Doctor checking the database...`])
    assert.equal(result, 'Everything in sync 🔄')

    process.chdir(cwd)
  })

  it('should fail when schema and db dont match', async () => {
    const tmpDir = tempy.directory()
    await copy({
      from: path.join(__dirname, 'fixtures/schema-db-out-of-sync'),
      to: tmpDir,
      recursive: true,
    })
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const doctor = Doctor.new()
    const errLog = []
    const oldConsoleError = console.error
    console.error = (...args) => {
      errLog.push(...args)
    }
    let err
    try {
      const result = await doctor.parse([])
    } catch (e) {
      err = e
    }
    console.error = oldConsoleError

    assert.equal(
      stripAnsi(err.message),
      `

Post
↪ Model is missing in database


User
↪ Field name is missing in database
↪ Field posts is missing in database
`,
    )

    process.chdir(cwd)
  })
})
