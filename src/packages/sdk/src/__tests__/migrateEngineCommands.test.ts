import { execaCommand } from '../migrateEngineCommands'

describe('migrateEngineCommands', () => {
  test('check if connection string is in execaCommand error', async () => {
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
