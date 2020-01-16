import { join } from 'path'
import mkdir from 'make-dir'
import { promisify } from 'util'
import fs from 'fs'
import rimraf from 'rimraf'
import { Init, defaultSchema } from '../commands/Init'

const del = promisify(rimraf)
const tmp = join(__dirname, '../../tmp')

beforeEach(async () => {
  await del(tmp)
  await mkdir(tmp)
})

beforeEach(async () => {
  await del(tmp)
})

test('is schema wriiten on disk replace', async () => {
  const init = Init.new()
  const result = await init.parse(['tmp'])

  const schema = fs.readFileSync(join(tmp, 'prisma/schema.prisma'), 'utf-8')

  expect(schema).toMatch(defaultSchema)
  expect(result).toMatchSnapshot(result)
})
