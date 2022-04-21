import { jestConsoleContext, jestContext } from '@prisma/sdk'

import { redactCommandArray, SENSITIVE_CLI_OPTIONS, tryToReadDataFromSchema } from '../utils/checkpoint'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should redact --option [value]', () => {
  for (const option of SENSITIVE_CLI_OPTIONS) {
    expect(redactCommandArray(['cmd', option, `secret`])).toEqual(['cmd', option, '[redacted]'])
  }
})

it('should redact --option=[value]', () => {
  for (const option of SENSITIVE_CLI_OPTIONS) {
    expect(redactCommandArray(['cmd', `${option}=secret`])).toEqual(['cmd', `${option}=[redacted]`])
  }
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
