import fs from 'fs-jetpack'
import { Format } from '../Format'
import { Context } from './__helpers__/context'

const ctx = Context.new().assemble()

it('format should add a trailing EOL', async () => {
  ctx.fixture('example-project/prisma')
  await Format.new().parse([])
  expect(fs.read('schema.prisma')).toMatchSnapshot()
})

it('format should add missing backrelation', async () => {
  ctx.fixture('example-project/prisma')
  await Format.new().parse(['--schema=missing-backrelation.prisma'])
  expect(fs.read('missing-backrelation.prisma')).toMatchSnapshot()
})

it('format should throw if schema is broken', async () => {
  ctx.fixture('example-project/prisma')
  await expect(
    Format.new().parse(['--schema=broken.prisma']),
  ).rejects.toThrowError()
})
