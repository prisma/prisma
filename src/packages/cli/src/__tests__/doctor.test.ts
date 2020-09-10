import * as FSJet from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import path from 'path'
import tempy from 'tempy'
import { Doctor } from '../Doctor'

const ctx: {
  tmpDir: string
  fs: FSJetpack
  fixture: (name: string) => void
  mocked: { 'console.error': jest.SpyInstance; cwd: string }
} = {} as any

beforeEach(() => {
  ctx.tmpDir = tempy.directory()
  ctx.fs = FSJet.cwd(ctx.tmpDir)
  ctx.mocked = {
    cwd: process.cwd(),
    'console.error': jest.spyOn(console, 'error').mockImplementation(() => {}),
  }
  ctx.fixture = (name: string) => {
    ctx.fs.copy(path.join(__dirname, 'fixtures', name), '.', {
      overwrite: true,
    })
  }
  process.chdir(ctx.tmpDir)
})

afterEach(() => {
  ctx.mocked['console.error'].mockRestore()
  process.chdir(ctx.mocked.cwd)
})

it('doctor should succeed when schema and db do match', async () => {
  ctx.fixture('example-project/prisma')
  const result = Doctor.new().parse([])
  await expect(result).resolves.toEqual('Everything in sync 🔄')
  expect(ctx.mocked['console.error'].mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        👩‍⚕️🏥 Prisma Doctor checking the database...,
      ],
    ]
  `)
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.remove('dev.db')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `P1003: SQLite database file doesn't exist`,
  )
})

it('should fail when prisma schema is missing', async () => {
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `Either provide --schema or make sure that you are in a folder with a schema.prisma file.`,
  )
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.write('dev.db', '')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P4001

          The introspected database was empty: file:dev.db

        `)
})

it('should fail when schema and db do not match', async () => {
  ctx.fixture('schema-db-out-of-sync')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`


          NewPost
          ↪ Model is missing in database


          User
          ↪ Field newName is missing in database
          ↪ Field newPosts is missing in database

        `)
})
