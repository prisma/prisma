import { absolutizeRelativePath } from '../absolutizeRelativePath'

test('parses files correctly', () => {
  const cwd = '/Users/user/code/project'
  expect(absolutizeRelativePath('file:db/file.db', cwd)).toMatchInlineSnapshot(
    `"file://Users/user/code/project/db/file.db"`,
  )
  expect(absolutizeRelativePath('file://User/name/my/file.db', cwd)).toMatchInlineSnapshot(
    `"file://User/name/my/file.db"`,
  )
  expect(absolutizeRelativePath('file:/User/name/file.db', cwd)).toMatchInlineSnapshot(`"file://User/name/file.db"`)
  expect(absolutizeRelativePath('file:../name/file.db', cwd)).toMatchInlineSnapshot(
    `"file://Users/user/code/name/file.db"`,
  )
})
