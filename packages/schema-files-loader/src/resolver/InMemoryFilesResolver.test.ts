import { InMemoryFilesResolver } from './InMemoryFilesResolver'

test('getEntryType', async () => {
  const resolver = new InMemoryFilesResolver()
  resolver.addFile('/some/path/file.prisma', '// hello')

  expect(await resolver.getEntryType('/some/path/file.prisma')).toEqual({ kind: 'file' })
  expect(await resolver.getEntryType('/some/path')).toEqual({ kind: 'directory' })
})

test('getFileContents', async () => {
  const resolver = new InMemoryFilesResolver()
  resolver.addFile('/some/path/file.prisma', '// hello')

  expect(await resolver.getFileContents('/some/path/file.prisma')).toBe('// hello')
  expect(await resolver.getFileContents('/some/path/nonexisting.prisma')).toBe(undefined)
  expect(await resolver.getFileContents('/some/nonexisting/file.prisma')).toBe(undefined)
})

test('listDirContents', async () => {
  const resolver = new InMemoryFilesResolver()
  resolver.addFile('/some/path/1.prisma', '// hello 1')
  resolver.addFile('/some/path/2.prisma', '// hello 2')

  expect(await resolver.listDirContents('/some/path')).toEqual(['1.prisma', '2.prisma'])
})
