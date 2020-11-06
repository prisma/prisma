import { validatePrismaClientOptions } from '../runtime/utils/validatePrismaClientOptions'

describe('valid options', () => {
  test('empty', () => {
    expect.assertions(0)
    validatePrismaClientOptions({}, ['db'])
  })
  test('full', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        datasources: {
          db: {
            url: '',
          },
        },
        errorFormat: 'pretty',
        log: ['error'],
      },
      ['db'],
    )

    validatePrismaClientOptions(
      {
        datasources: {
          db: {
            url: '',
          },
        },
        errorFormat: 'pretty',
        log: [
          {
            emit: 'event',
            level: 'error',
          },
        ],
      },
      ['db'],
    )
  })
})

describe('invalid options', () => {
  test('typos', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          errorrFormat: 'minimal',
        } as any,
        ['db'],
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `Unknown property errorrFormat provided to PrismaClient constructor. Did you mean "errorFormat"?`,
    )
    expect(() =>
      validatePrismaClientOptions(
        {
          errorFormat: 'minimal',
          datasources: {
            asd: {},
          },
        },
        ['db'],
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `Unknown datasource asd provided to PrismaClient constructor.Available datasources: db`,
    )
    expect(() =>
      validatePrismaClientOptions(
        {
          errorFormat: 'minimal',
          datasources: {
            db: { murl: '' },
          },
        } as any,
        ['db'],
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      Invalid value {"db":{"murl":""}} for datasource "db" provided to PrismaClient constructor.
      It should have this form: { url: "CONNECTION_STRING" }
    `)
    expect(() =>
      validatePrismaClientOptions(
        {
          errorFormat: 'minimal',
          log: [{ helo: 'world' }],
        } as any,
        ['db'],
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `Invalid property helo for "log" provided to PrismaClient constructor`,
    )
    expect(() =>
      validatePrismaClientOptions(
        {
          errorFormat: 'minimal',
          log: ['muery'],
        } as any,
        ['db'],
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `Invalid log level "muery" provided to PrismaClient constructor. Did you mean "query"?`,
    )
  })
})
