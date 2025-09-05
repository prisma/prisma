import { describe, expect, test } from 'vitest'

import { CompositeFilesResolver } from './CompositeFilesResolver'
import { InMemoryFilesResolver } from './InMemoryFilesResolver'

describe('caseSensitive=true', () => {
  test('listDirContents', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: true })
    primary.addFile('/dir/in-primary.prisma', '// a')
    primary.addFile('/dir/different-case.prisma', '// different case primary')
    primary.addFile('/dir/in-both.prisma', '// b')

    const secondary = new InMemoryFilesResolver({ caseSensitive: true })
    secondary.addFile('/dir/in-both.prisma', '// b old')
    secondary.addFile('/dir/Different-Case.prisma', '// different case secondary')
    secondary.addFile('/dir/in-secondary.prisma', '// c')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: true })
    const contents = await composite.listDirContents('/dir')

    expect(contents).toEqual([
      'in-primary.prisma',
      'different-case.prisma',
      'in-both.prisma',
      'Different-Case.prisma',
      'in-secondary.prisma',
    ])
  })

  test('getEntryType', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: true })
    primary.addFile('/dir/a.prisma', '// a')
    primary.addFile('/dir/dir1/.thing', '')

    const secondary = new InMemoryFilesResolver({ caseSensitive: true })
    secondary.addFile('/dir/b.prisma', '// b')
    secondary.addFile('/dir/dir1', '// dir 1')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: true })

    expect(await composite.getEntryType('/dir/a.prisma')).toEqual({ kind: 'file' })
    expect(await composite.getEntryType('/dir/A.prisma')).toBeUndefined()
    expect(await composite.getEntryType('/dir/dir1')).toEqual({ kind: 'directory' })
    expect(await composite.getEntryType('/dir/does-not-exist')).toBeUndefined()
  })

  test('getFileContents', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: true })
    primary.addFile('/dir/in-primary.prisma', '// from primary')
    primary.addFile('/dir/in-both.prisma', '// primary overrides secondary')

    const secondary = new InMemoryFilesResolver({ caseSensitive: true })
    secondary.addFile('/dir/in-both.prisma', '// this should not be returned')
    secondary.addFile('/dir/in-secondary.prisma', '// from secondary')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: true })

    expect(await composite.getFileContents('/dir/in-primary.prisma')).toBe('// from primary')
    expect(await composite.getFileContents('/dir/IN-PRIMARY.prisma')).toBeUndefined()
    expect(await composite.getFileContents('/dir/in-both.prisma')).toBe('// primary overrides secondary')
    expect(await composite.getFileContents('/dir/in-secondary.prisma')).toBe('// from secondary')
  })
})

describe('caseSensitive=false', () => {
  test('listDirContents', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: false })
    primary.addFile('/dir/in-primary.prisma', '// a')
    primary.addFile('/dir/different-case.prisma', '// different case primary')
    primary.addFile('/dir/in-both.prisma', '// b')

    const secondary = new InMemoryFilesResolver({ caseSensitive: false })
    secondary.addFile('/dir/in-both.prisma', '// b old')
    secondary.addFile('/dir/Different-Case.prisma', '// different case secondary')
    secondary.addFile('/dir/in-secondary.prisma', '// c')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: false })
    const contents = await composite.listDirContents('/dir')

    expect(contents).toEqual(['in-primary.prisma', 'different-case.prisma', 'in-both.prisma', 'in-secondary.prisma'])
  })

  test('getEntryType', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: false })
    primary.addFile('/dir/a.prisma', '// a')
    primary.addFile('/dir/dir1/.thing', '')

    const secondary = new InMemoryFilesResolver({ caseSensitive: false })
    secondary.addFile('/dir/b.prisma', '// b')
    secondary.addFile('/dir/dir1', '// dir 1')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: false })

    expect(await composite.getEntryType('/dir/a.prisma')).toEqual({ kind: 'file' })
    expect(await composite.getEntryType('/dir/A.prisma')).toEqual({ kind: 'file' })
    expect(await composite.getEntryType('/dir/dir1')).toEqual({ kind: 'directory' })
    expect(await composite.getEntryType('/dir/does-not-exist')).toBeUndefined()
  })

  test('getFileContents', async () => {
    const primary = new InMemoryFilesResolver({ caseSensitive: false })
    primary.addFile('/dir/in-primary.prisma', '// from primary')
    primary.addFile('/dir/in-both.prisma', '// primary overrides secondary')

    const secondary = new InMemoryFilesResolver({ caseSensitive: false })
    secondary.addFile('/dir/in-both.prisma', '// this should not be returned')
    secondary.addFile('/dir/in-secondary.prisma', '// from secondary')

    const composite = new CompositeFilesResolver(primary, secondary, { caseSensitive: false })

    expect(await composite.getFileContents('/dir/in-primary.prisma')).toBe('// from primary')
    expect(await composite.getFileContents('/dir/IN-PRIMARY.prisma')).toBe('// from primary')
    expect(await composite.getFileContents('/dir/in-both.prisma')).toBe('// primary overrides secondary')
    expect(await composite.getFileContents('/dir/in-secondary.prisma')).toBe('// from secondary')
  })
})
