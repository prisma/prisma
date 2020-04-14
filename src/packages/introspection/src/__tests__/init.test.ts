import { join } from 'path'
import mkdir from 'make-dir'
import { promisify } from 'util'
import fs from 'fs'
import rimraf from 'rimraf'
import { Init, defaultSchema, defaultEnv } from '../commands/Init'
import stripAnsi from 'strip-ansi'

const del = promisify(rimraf)
const tmp = join(__dirname, '../../prisma')

beforeEach(async () => {
  await del(tmp)
})

afterAll(async () => {
  await del(tmp)
})

test('is schema and env written on disk replace', async () => {
  const init = Init.new()
  const result = stripAnsi(await init.parse([]))

  const schema = fs.readFileSync(join(tmp, 'schema.prisma'), 'utf-8')
  const env = fs.readFileSync(join(tmp, '.env'), 'utf-8')

  expect(schema).toMatch(defaultSchema)
  expect(env).toMatch(defaultEnv)
  expect(result).toMatchSnapshot(result)
})
