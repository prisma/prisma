import { Doctor } from '../Doctor'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('doctor should succeed when schema and db do match', async () => {
  ctx.fixture('example-project/prisma')
  const result = Doctor.new().parse([])
  await expect(result).resolves.toEqual('Everything in sync 🔄')
  expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.remove('dev.db')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingSnapshot()
})

it('should fail when prisma schema is missing', async () => {
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingSnapshot()
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.write('dev.db', '')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingSnapshot()
})

it('should fail when schema and db do not match', async () => {
  ctx.fixture('schema-db-out-of-sync')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingSnapshot()
})
