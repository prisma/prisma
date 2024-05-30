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
