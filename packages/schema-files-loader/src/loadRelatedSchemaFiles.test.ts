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
