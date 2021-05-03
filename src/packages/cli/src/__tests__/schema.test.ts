import fs from 'fs-jetpack'
import { Schema } from '../Schema'
import { Context } from './__helpers__/context'

const ctx = Context.new().assemble()

it('schema should build a valid schema.prisma from multiple .prisma files', async () => {
  ctx.fixture('example-project/prisma')
  await Schema.new().parse(['--schema=./schema.prisma', '--input=./models'])
  expect(fs.read('schema.prisma')).toMatchSnapshot()
})

it('schema should throw if schema is broken', async () => {
  ctx.fixture('example-project/prisma')
  await expect(
    Schema.new().parse(['--schema=broken.prisma', '--input=./models']),
  ).rejects.toThrowError()
})

it('schema should throw if input is not provided', async () => {
  ctx.fixture('example-project/prisma')
  await expect(
    Schema.new().parse(['--schema=broken.prisma']),
  ).rejects.toThrowError()
})
