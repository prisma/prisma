import fs from 'node:fs'

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'

const mockFormatSchema = jest.fn(async () => [['schema.prisma', 'model A {\n  id Int @id\n}\r\n']])
const mockValidate = jest.fn()

jest.mock('@prisma/internals', () => {
  const actual = jest.requireActual('@prisma/internals')
  return {
    ...actual,
    formatSchema: (...args: unknown[]) => mockFormatSchema(...args),
    validate: (...args: unknown[]) => mockValidate(...args),
  }
})

import { Format } from '../../Format'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('format (newline normalization)', () => {
  it('writes LF-only even if formatter returns CRLF', async () => {
    ctx.fixture('example-project/prisma')

    await Format.new().parse([], defaultTestConfig())

    const schema = fs.readFileSync('schema.prisma')
    expect(schema.includes('\r')).toBe(false)
  })
})

