import path from 'node:path'

import { loadSchemaFiles } from './schema-files-loader'

function fixturePath(...parts: string[]) {
  return path.join(__dirname, '__fixtures__', ...parts)
}

describe('loadSchemaFiles', () => {
  test('simple list', async () => {
    const files = await loadSchemaFiles(fixturePath('simple'))
    expect(files).toEqual([
      [fixturePath('simple', 'a.prisma'), '// this is a\n'],
      [fixturePath('simple', 'b.prisma'), '// this is b\n'],
    ])
  })

  test('ignores non *.prisma files', async () => {
    const files = await loadSchemaFiles(fixturePath('non-prisma-files'))
    expect(files).toEqual([
      [fixturePath('non-prisma-files', 'a.prisma'), '// this is a\n'],
      [fixturePath('non-prisma-files', 'b.prisma'), '// this is b\n'],
    ])
  })

  test('ignores subfolders *.prisma files', async () => {
    const files = await loadSchemaFiles(fixturePath('subfolder'))
    expect(files).toEqual([[fixturePath('subfolder', 'a.prisma'), '// this is a\n']])
  })

  test('ignores *.prisma directories', async () => {
    const files = await loadSchemaFiles(fixturePath('with-directory'))
    expect(files).toEqual([[fixturePath('with-directory', 'a.prisma'), '// this is a\n']])
  })

  test('reads symlinks', async () => {
    const files = await loadSchemaFiles(fixturePath('symlink'))
    // link point to `simple` directory
    expect(files).toEqual([[fixturePath('simple', 'a.prisma'), '// this is a\n']])
  })

  test('ignores symlinks to directories', async () => {
    const files = await loadSchemaFiles(fixturePath('symlinks-to-dir'))
    expect(files).toEqual([])
  })
})
