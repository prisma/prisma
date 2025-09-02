import { expect, test } from 'vitest'

import { loadRelatedSchemaFiles } from './loadRelatedSchemaFiles'
import { fixturePath, loadedFile } from './testUtils'

test('with multiple schema files', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('multi-file', 'a.prisma'))
  expect(files).toEqual([loadedFile('multi-file', 'a.prisma'), loadedFile('multi-file', 'b.prisma')])
})

test('subfolder, starting from top level', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('subfolder', 'a.prisma'))
  expect(files).toEqual([loadedFile('subfolder', 'a.prisma'), loadedFile('subfolder', 'nested', 'b.prisma')])
})

test('subfolder, starting from nested level', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('subfolder', 'nested', 'b.prisma'))
  expect(files).toEqual([loadedFile('subfolder', 'a.prisma'), loadedFile('subfolder', 'nested', 'b.prisma')])
})

test('with feature enabled, starting from a file with no generator block', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('multi-file', 'b.prisma'))
  expect(files).toEqual([loadedFile('multi-file', 'a.prisma'), loadedFile('multi-file', 'b.prisma')])
})

test('invalid schema and feature enabled', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('multi-file-invalid-schema', 'a.prisma'))
  expect(files).toEqual([
    loadedFile('multi-file-invalid-schema', 'a.prisma'),
    loadedFile('multi-file-invalid-schema', 'b.prisma'),
  ])
})

test('empty prisma schema should load', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('empty-schema', 'schema.prisma'))

  expect(files).toEqual([loadedFile('empty-schema', 'schema.prisma')])
})
