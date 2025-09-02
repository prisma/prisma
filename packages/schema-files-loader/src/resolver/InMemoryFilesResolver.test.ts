import { describe, expect, test } from 'vitest'

import { InMemoryFilesResolver } from './InMemoryFilesResolver'

describe('case-sensitive = true', () => {
  test('getEntryType', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: true })
    resolver.addFile('/some/path/file.prisma', '// hello')

    expect(await resolver.getEntryType('/some/path/file.prisma')).toEqual({ kind: 'file' })
    expect(await resolver.getEntryType('/some/path')).toEqual({ kind: 'directory' })
  })

  test('getFileContents', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: true })
    resolver.addFile('/some/path/file.prisma', '// hello file')

    expect(await resolver.getFileContents('/some/path/file.prisma')).toBe('// hello file')
    expect(await resolver.getFileContents('/some/path/File.prisma')).toBe(undefined)
    expect(await resolver.getFileContents('/some/path/nonexisting.prisma')).toBe(undefined)
    expect(await resolver.getFileContents('/some/nonexisting/file.prisma')).toBe(undefined)
  })

  test('listDirContents', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: true })
    resolver.addFile('/some/path/Foo.prisma', '// hello Foo')
    resolver.addFile('/some/path/foo.prisma', '// hello foo')
    resolver.addFile('/some/path/Bar.prisma', '// hello Bar')

    expect(await resolver.listDirContents('/some/path')).toEqual(['Foo.prisma', 'foo.prisma', 'Bar.prisma'])
  })
})

describe('case-sensitive = false', () => {
  test('getEntryType', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: false })
    resolver.addFile('/some/path/file.prisma', '// hello')

    expect(await resolver.getEntryType('/some/path/file.prisma')).toEqual({ kind: 'file' })
    expect(await resolver.getEntryType('/some/path')).toEqual({ kind: 'directory' })
  })

  test('getFileContents', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: false })
    resolver.addFile('/some/path/file.prisma', '// hello file')

    // should point to the same path
    expect(await resolver.getFileContents('/some/path/file.prisma')).toBe('// hello file')
    expect(await resolver.getFileContents('/some/path/File.prisma')).toBe('// hello file')

    expect(await resolver.getFileContents('/some/path/nonexisting.prisma')).toBe(undefined)
    expect(await resolver.getFileContents('/some/nonexisting/file.prisma')).toBe(undefined)
  })

  test('listDirContents', async () => {
    const resolver = new InMemoryFilesResolver({ caseSensitive: false })
    resolver.addFile('/some/path/Foo.prisma', '// hello Foo')
    resolver.addFile('/some/path/foo.prisma', '// hello foo')
    resolver.addFile('/some/path/Bar.prisma', '// hello Bar')

    expect(await resolver.listDirContents('/some/path')).toEqual(['foo.prisma', 'Bar.prisma'])
  })
})
