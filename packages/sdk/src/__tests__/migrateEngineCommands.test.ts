import { execaCommand, doesSqliteDbExist, canConnectToDatabase, createDatabase } from '../migrateEngineCommands'
import tempy from 'tempy'

describe('execaCommand', () => {
  test('check if connection string is in error', async () => {
    try {
      await execaCommand({
        connectionString: 'postgresql://user:mysecret@localhost',
        cwd: process.cwd(),
        migrationEnginePath: undefined,
        engineCommandName: 'drop-database',
      })
    } catch (e) {
      const message = e.message as string
      expect(message.includes('mysecret')).toBeFalsy()
      expect(message.includes('<REDACTED>')).toBeTruthy()
    }
  })
})

describe('doesSqliteDbExist', () => {
  test('exist - sqlite:', async () => {
    await expect(doesSqliteDbExist('sqlite:./introspection/blog.db', __dirname)).resolves.toEqual(true)
  })

  test('exist - file:', async () => {
    await expect(doesSqliteDbExist('file:./introspection/blog.db', __dirname)).resolves.toEqual(true)
  })

  test('does not exist - sqlite:', async () => {
    await expect(doesSqliteDbExist('sqlite:./doesnotexist.db', __dirname)).resolves.toEqual(false)
  })

  test('does not exist - file:', async () => {
    await expect(doesSqliteDbExist('file:./doesnotexist.db', __dirname)).resolves.toEqual(false)
  })

  test('should error if no schemaDir and no schema found', async () => {
    await expect(doesSqliteDbExist('file:./doesnotexist.db')).rejects.toThrowError()
  })
})

describe('canConnectToDatabase', () => {
  test('sqlite - can', async () => {
    await expect(canConnectToDatabase('sqlite:./introspection/blog.db', __dirname)).resolves.toEqual(true)
  })

  test('sqlite - cannot', async () => {
    await expect(canConnectToDatabase('file:./doesnotexist.db')).resolves.toMatchInlineSnapshot(`
            Object {
              "code": "P1003",
              "message": "SQLite database file doesn't exist",
            }
          `)
  })

  test('postgresql - server does not exist', async () => {
    await expect(
      canConnectToDatabase('postgresql://johndoe:randompassword@doesnotexist:5432/mydb?schema=public', __dirname),
    ).resolves.toMatchInlineSnapshot(`
            Object {
              "code": "P1001",
              "message": "Can't reach database server at \`doesnotexist\`:\`5432\`

            Please make sure your database server is running at \`doesnotexist\`:\`5432\`.",
            }
          `)
  })
})

describe('createDatabase', () => {
  test('sqlite - already exist', async () => {
    await expect(createDatabase('sqlite:./introspection/blog.db', __dirname)).resolves.toEqual(false)
  })

  test('sqlite - does not exist', async () => {
    await expect(createDatabase('sqlite:./doesnotexist.db', tempy.directory())).resolves.toEqual(true)
  })

  test('sqlite - invalid cwd (file path instead of directory)', async () => {
    await expect(createDatabase('sqlite:./doesnotexist.db', tempy.file())).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Migration engine exited."`,
    )
  })

  test('postgresql - server does not exist', async () => {
    await expect(createDatabase('postgresql://johndoe:randompassword@doesnotexist:5432/mydb?schema=public', __dirname))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
            "P1001: Can't reach database server at \`doesnotexist\`:\`5432\`

            Please make sure your database server is running at \`doesnotexist\`:\`5432\`."
          `)
  })

  test('invalid database type', async () => {
    await expect(createDatabase('invalid:somedburl')).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unknown database type invalid:"`,
    )
  })

  test('empty connection string', async () => {
    await expect(createDatabase('')).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Connection url is empty. See https://www.prisma.io/docs/reference/database-reference/connection-urls"`,
    )
  })
})
