import { jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs-jetpack'

import { Format } from '../../Format'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

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
  await expect(Format.new().parse(['--schema=broken.prisma'])).rejects.toThrowError()
})

it('format should succeed and show a warning on stderr (preview feature deprecated)', async () => {
  ctx.fixture('lint-warnings')
  await expect(Format.new().parse(['--schema=preview-feature-deprecated.prisma'])).resolves.toBeTruthy()

  // stderr
  expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            Prisma schema warning:
            - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature.
      `)
  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
})

it('format should throw with an error and show a warning on stderr (preview feature deprecated)', async () => {
  ctx.fixture('lint-warnings')
  await expect(Format.new().parse(['--schema=preview-feature-deprecated-and-error.prisma'])).rejects.toThrowError(
    'P1012',
  )

  // stderr
  expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            Prisma schema warning:
            - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature.
      `)
  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
})
