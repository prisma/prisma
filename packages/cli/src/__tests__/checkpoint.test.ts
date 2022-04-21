import { jestConsoleContext, jestContext } from '@prisma/sdk'

import { redactCommandArray, tryToReadDataFromSchema } from '../utils/checkpoint'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should redact --url [value]', () => {
  expect(redactCommandArray(['cmd', '--url', 'redactme'])).toMatchInlineSnapshot(`
    Array [
      cmd,
      --url,
      [redacted],
    ]
  `)
})

it('should redact --url=[value]', () => {
  expect(redactCommandArray(['cmd', '--url=redactme'])).toMatchInlineSnapshot(`
    Array [
      cmd,
      --url=[redacted],
    ]
  `)
})

it('should read data from Prisma schema', async () => {
  ctx.fixture('checkpoint-read-schema')

  await expect(tryToReadDataFromSchema('./schema.prisma')).resolves.toMatchInlineSnapshot(`
          Object {
            schemaGeneratorsProviders: Array [
              prisma-client-js,
              something,
            ],
            schemaPreviewFeatures: Array [
              extendedIndexes,
              cockroachdb,
            ],
            schemaProvider: sqlite,
          }
        `)
})
