import { CompositeFilesResolver } from './CompositeFilesResolver'
import { InMemoryFilesResolver } from './InMemoryFilesResolver'

test('listDirContents', async () => {
  const primary = new InMemoryFilesResolver()
  primary.addFile('/dir/in-primary.prisma', '// a')
  primary.addFile('/dir/in-both.prisma', '// b')

  const secondary = new InMemoryFilesResolver()
  secondary.addFile('/dir/in-both.prisma', '// b old')
  secondary.addFile('/dir/in-secondary.prisma', '// c')

  const composite = new CompositeFilesResolver(primary, secondary)
  const contents = await composite.listDirContents('/dir')

  expect(contents).toEqual(['in-primary.prisma', 'in-both.prisma', 'in-secondary.prisma'])
})

test('getEntryType', async () => {
  const primary = new InMemoryFilesResolver()
  primary.addFile('/dir/a.prisma', '// a')
  primary.addFile('/dir/dir1/.thing', '')

  const secondary = new InMemoryFilesResolver()
  secondary.addFile('/dir/b.prisma', '// b')
  secondary.addFile('/dir/dir1', '// dir 1')

  const composite = new CompositeFilesResolver(primary, secondary)

  expect(await composite.getEntryType('/dir/a.prisma')).toEqual({ kind: 'file' })
  expect(await composite.getEntryType('/dir/dir1')).toEqual({ kind: 'directory' })
  expect(await composite.getEntryType('/dir/does-not-exist')).toBeUndefined()
})

test('getFileContents', async () => {
  const primary = new InMemoryFilesResolver()
  primary.addFile('/dir/in-primary.prisma', '// from primary')
  primary.addFile('/dir/in-both.prisma', '// primary overrides secondary')

  const secondary = new InMemoryFilesResolver()
  secondary.addFile('/dir/in-both.prisma', '// this should not be returned')
  secondary.addFile('/dir/in-secondary.prisma', '// from secondary')

  const composite = new CompositeFilesResolver(primary, secondary)

  expect(await composite.getFileContents('/dir/in-primary.prisma')).toBe('// from primary')
  expect(await composite.getFileContents('/dir/in-both.prisma')).toBe('// primary overrides secondary')
  expect(await composite.getFileContents('/dir/in-secondary.prisma')).toBe('// from secondary')
})
