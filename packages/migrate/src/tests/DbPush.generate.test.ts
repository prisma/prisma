const execaMock = jest.fn().mockResolvedValue({})
jest.mock('execa', () => ({ execaNode: execaMock }))

jest.mock('../Migrate', () => ({
  Migrate: {
    setup: jest.fn().mockResolvedValue({
      push: jest.fn().mockResolvedValue({
        unexecutable: [],
        warnings: [],
        executedSteps: 1,
      }),
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      engine: { stop: jest.fn().mockResolvedValue(undefined) },
    }),
  },
}))

jest.mock(
  '@prisma/internals',
  () => ({
    arg: (argv: string[], _opts: any) => (argv.includes('--sql') ? { '--sql': true } : { '--sql': false }),
    isError: () => false,
    loadSchemaContext: () => ({
      schemaRootDir: process.cwd(),
      primaryDatasource: { activeProvider: 'sqlite' },
      generators: [],
      loadedFromPathForLogMessages: 'schema.prisma',
    }),
    inferDirectoryConfig: () => ({ migrationsDirPath: '/tmp' }),
    validatePrismaConfigWithDatasource: () => ({}),
    getSchemaDatasourceProvider: () => 'sqlite',
    getCommandWithExecutor: () => 'prisma db push --force-reset',
    canPrompt: () => false,
    checkUnsupportedDataProxy: () => undefined,
    format: (s: string) => s,
    formatms: (n: number) => String(n),
    Command: class {},
    HelpError: class extends Error {},
    MigrateTypes: { SchemaFilter: {} },
    setClassName: (fn: any, _name: string) => fn,
  }),
  { virtual: true },
)

jest.mock('../utils/ensureDatabaseExists', () => ({
  ensureDatabaseExists: jest.fn().mockResolvedValue(undefined),
  parseDatasourceInfo: jest.fn().mockReturnValue({ prettyProvider: 'sqlite' }),
}))
jest.mock('../utils/printDatasource', () => ({ printDatasource: jest.fn() }))

// Mock @prisma/debug as a virtual module so tests don't need the workspace package
jest.mock('@prisma/debug', () => () => () => {}, { virtual: true })

const { DbPush } = require('../commands/DbPush')

describe('DbPush --sql', () => {
  beforeEach(() => {
    execaMock.mockClear()
  })

  test('invokes execaNode to run generate --sql when --sql flag is passed', async () => {
    const dbPush = DbPush.new()
    const fakeConfig: any = {}
    await dbPush.parse(['--sql'], fakeConfig, process.cwd())
    expect(execaMock).toHaveBeenCalled()
    // verify that the first argument was process.argv[1] or node binary (string)
    const callArgs = execaMock.mock.calls[0]
    expect(callArgs.length).toBeGreaterThanOrEqual(2)
    // second argument should include 'generate' and '--sql'
    const passedArgs = callArgs[1]
    expect(Array.isArray(passedArgs)).toBe(true)
    expect(passedArgs).toContain('generate')
    expect(passedArgs).toContain('--sql')
  })
})
