import path from 'node:path'

import { loadSchemaFiles } from './loadSchemaFiles'
import { CompositeFilesResolver, InMemoryFilesResolver, realFsResolver } from './resolver'
import { fixturePath, line, loadedFile } from './testUtils'

test('simple list', async () => {
  const files = await loadSchemaFiles(fixturePath('simple'))
  expect(files).toEqual([
    [fixturePath('simple', 'a.prisma'), line('// this is a')],
    [fixturePath('simple', 'b.prisma'), line('// this is b')],
  ])
})

test('ignores non *.prisma files', async () => {
  const files = await loadSchemaFiles(fixturePath('non-prisma-files'))
  expect(files).toEqual([
    [fixturePath('non-prisma-files', 'a.prisma'), line('// this is a')],
    [fixturePath('non-prisma-files', 'b.prisma'), line('// this is b')],
  ])
})

test('works with subfolders', async () => {
  const files = await loadSchemaFiles(fixturePath('subfolder'))
  expect(files).toEqual([
    loadedFile('subfolder', 'a.prisma'),
    [fixturePath('subfolder', 'nested', 'b.prisma'), line('// this is b')],
  ])
})

test('ignores *.prisma directories', async () => {
  const files = await loadSchemaFiles(fixturePath('with-directory'))
  expect(files).toEqual([[fixturePath('with-directory', 'a.prisma'), line('// this is a')]])
})

test('reads symlinks', async () => {
  const files = await loadSchemaFiles(fixturePath('symlink'))
  // link point to `simple` directory
  expect(files).toEqual([[fixturePath('simple', 'a.prisma'), line('// this is a')]])
})

test('ignores symlinks to directories', async () => {
  const files = await loadSchemaFiles(fixturePath('symlinks-to-dir'))
  expect(files).toEqual([])
})

test('allows to use in-memory resolver', async () => {
  const resolver = new InMemoryFilesResolver({ caseSensitive: true })
  resolver.addFile(path.join('/', 'some', 'dir', 'a.prisma'), '// this is a')
  resolver.addFile(path.join('/', 'some', 'dir', 'b.prisma'), '// this is b')
  const files = await loadSchemaFiles('/some/dir', resolver)

  expect(files).toEqual([
    [path.join('/', 'some', 'dir', 'a.prisma'), '// this is a'],
    [path.join('/', 'some', 'dir', 'b.prisma'), '// this is b'],
  ])
})

test('allows to use composite resolver', async () => {
  const inMemory = new InMemoryFilesResolver({ caseSensitive: true })
  inMemory.addFile(fixturePath('simple', 'b.prisma'), line('// b is overridden'))
  inMemory.addFile(fixturePath('simple', 'c.prisma'), line('// in memory only'))

  const resolver = new CompositeFilesResolver(inMemory, realFsResolver, { caseSensitive: true })
  const files = await loadSchemaFiles(fixturePath('simple'), resolver)

  expect(files).toEqual([
    [fixturePath('simple', 'b.prisma'), line('// b is overridden')],
    [fixturePath('simple', 'c.prisma'), line('// in memory only')],
    [fixturePath('simple', 'a.prisma'), line('// this is a')],
  ])
})
