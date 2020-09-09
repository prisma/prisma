import * as FSJet from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import path from 'path'
import tempy from 'tempy'
import { Doctor } from '../Doctor'

const ctx: {
  tmpDir: string
  logs: string[]
  fs: FSJetpack
  mocked: { 'console.error': any; cwd: string }
} = {} as any

beforeEach(() => {
  ctx.logs = []
  ctx.tmpDir = tempy.directory()
  ctx.mocked = {} as any
  ctx.mocked['console.error'] = console.error
  ctx.mocked.cwd = process.cwd()
  ctx.fs = FSJet.cwd(ctx.tmpDir)
  console.error = (...args) => {
    ctx.logs.push(...args)
  }
  process.chdir(ctx.tmpDir)
})

afterEach(() => {
  console.error = ctx.mocked['console.error']
  process.chdir(ctx.mocked.cwd)
})

it('doctor should succeed when schema and db do match', async () => {
  ctx.fs.copy(path.join(__dirname, 'fixtures/example-project/prisma'), '.', {
    overwrite: true,
  })
  await expect(Doctor.new().parse([])).resolves.toEqual('Everything in sync 🔄')
  expect(ctx.logs).toEqual([`👩‍⚕️🏥 Prisma Doctor checking the database...`])
})

it('should fail when db is missing', async () => {
  ctx.fs.copy(path.join(__dirname, 'fixtures/schema-db-out-of-sync'), '.', {
    overwrite: true,
  })
  ctx.fs.remove('dev.db')

  await expect(
    Doctor.new().parse([]),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"P1003: SQLite database file doesn't exist"`,
  )
})

it('should fail when db is empty', async () => {
  ctx.fs.copy(path.join(__dirname, 'fixtures/schema-db-out-of-sync'), '.', {
    overwrite: true,
  })
  ctx.fs.write(path.join(ctx.tmpDir, 'dev.db'), '')

  await expect(Doctor.new().parse([])).rejects
    .toThrowErrorMatchingInlineSnapshot(`
          "[91mP4001[39m
          [91m[39m
          [91m[39m[91mThe introspected database was empty: file:dev.db[39m
          "
        `)
})

it('should fail when schema and db do not match', async () => {
  ctx.fs.copy(path.join(__dirname, 'fixtures/schema-db-out-of-sync'), '.', {
    overwrite: true,
  })

  await expect(Doctor.new().parse([])).rejects
    .toThrowErrorMatchingInlineSnapshot(`
          "

          [1m[4mNewPost[24m[22m
          ↪ Model is missing in database


          [1m[4mUser[24m[22m
          ↪ Field [1mnewName[22m is missing in database
          ↪ Field [1mnewPosts[22m is missing in database
          "
        `)
})
