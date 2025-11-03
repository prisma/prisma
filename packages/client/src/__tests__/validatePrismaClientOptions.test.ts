import type { RuntimeDataModel } from '@prisma/client-common'

import { PrismaClientOptions } from '../runtime'
import { ClientConfig, validatePrismaClientOptions } from '../runtime/utils/validatePrismaClientOptions'

const config: ClientConfig = {
  runtimeDataModel: {} as RuntimeDataModel,
  datasourceNames: ['db'],
  generator: {
    binaryTargets: [],
    name: 'prisma-client',
    output: { fromEnvVar: null, value: './generated/prisma' },
    previewFeatures: [],
    provider: { fromEnvVar: null, value: 'postgresql' },
    sourceFilePath: 'app.ts',
    config: {
      engineType: 'client',
    },
  },
}

{
  let globalEngineTypeOverride: string | undefined

  beforeAll(() => {
    globalEngineTypeOverride = process.env.PRISMA_CLIENT_ENGINE_TYPE
    delete process.env.PRISMA_CLIENT_ENGINE_TYPE
  })

  afterAll(() => {
    if (globalEngineTypeOverride != undefined) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = globalEngineTypeOverride
    }
  })
}

describe('valid options', () => {
  test('full', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        adapter: {} as any,
        datasources: {
          db: {
            url: '',
          },
        },
        errorFormat: 'pretty',
        log: ['error'],
      },
      config,
    )

    validatePrismaClientOptions(
      {
        adapter: {} as any,
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
      config,
    )
  })

  test('accelerate url', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        accelerateUrl: 'prisma://example?api_key=1',
      },
      config,
    )
  })
})

describe('invalid options', () => {
  test('empty', () => {
    expect(() => validatePrismaClientOptions({}, config)).toThrowErrorMatchingInlineSnapshot(`
      "Using engine type "client" requires either "adapter" or "accelerateUrl" to be provided to PrismaClient constructor.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('typos', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          errorsFormat: 'minimal',
        } as PrismaClientOptions,
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Unknown property errorsFormat provided to PrismaClient constructor. Did you mean "errorFormat"?
      Read more at https://pris.ly/d/client-constructor"
    `)
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          errorFormat: 'minimal',
          datasources: {
            asd: {},
          },
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Unknown datasource asd provided to PrismaClient constructor. Available datasources: db
      Read more at https://pris.ly/d/client-constructor"
    `)
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          errorFormat: 'minimal',
          datasources: {
            db: { murl: '' },
          },
        } as PrismaClientOptions,
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid value {"db":{"murl":""}} for datasource "db" provided to PrismaClient constructor.
      It should have this form: { url: "CONNECTION_STRING" }
      Read more at https://pris.ly/d/client-constructor"
    `)
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          errorFormat: 'minimal',
          log: [{ helo: 'world' }],
        } as unknown as PrismaClientOptions,
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid property helo for "log" provided to PrismaClient constructor
      Read more at https://pris.ly/d/client-constructor"
    `)
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          errorFormat: 'minimal',
          log: ['muery'],
        } as unknown as PrismaClientOptions,
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid log level "muery" provided to PrismaClient constructor. Did you mean "query"?
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('accelerate url with adapter', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          accelerateUrl: 'prisma://example?api_key=1',
          adapter: {} as any,
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "The "adapter" and "accelerateUrl" options are mutually exclusive. Please provide only one of them.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })
})
