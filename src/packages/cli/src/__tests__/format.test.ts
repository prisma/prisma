import * as fs from 'fs-jetpack'
import { Format } from '../Format'
import { Context } from './__helpers__/context'

const ctx = Context.new()

it('format should add a trailing EOL', async () => {
  ctx.fixture('example-project/prisma')
  await Format.new().parse([])
  expect(fs.read('schema.prisma')).toMatchSnapshot()
})
