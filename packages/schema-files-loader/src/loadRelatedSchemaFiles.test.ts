import { loadRelatedSchemaFiles } from './loadRelatedSchemaFiles'
import { fixturePath, loadedFile } from './testUtils'

test('without feature enabled', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('related-no-feature', 'a.prisma'))
  expect(files).toEqual([loadedFile('related-no-feature', 'a.prisma')])
})

test('with feature enabled', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('related-feature', 'a.prisma'))
  expect(files).toEqual([loadedFile('related-feature', 'a.prisma'), loadedFile('related-feature', 'b.prisma')])
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
  const files = await loadRelatedSchemaFiles(fixturePath('related-feature', 'b.prisma'))
  expect(files).toEqual([loadedFile('related-feature', 'a.prisma'), loadedFile('related-feature', 'b.prisma')])
})

test('invalid schema and feature enabled', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('related-feature-invalid-schema', 'a.prisma'))
  expect(files).toEqual([
    loadedFile('related-feature-invalid-schema', 'a.prisma'),
    loadedFile('related-feature-invalid-schema', 'b.prisma'),
  ])
})

test('empty prisma schema should load', async () => {
  const files = await loadRelatedSchemaFiles(fixturePath('empty-schema', 'schema.prisma'))

  expect(files).toEqual([loadedFile('empty-schema', 'schema.prisma')])
})
