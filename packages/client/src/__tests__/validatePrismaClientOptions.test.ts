import type { RuntimeDataModel } from '@prisma/client-common'

import { PrismaClientOptions } from '../runtime'
import { ClientConfig, validatePrismaClientOptions } from '../runtime/utils/validatePrismaClientOptions'

const config: ClientConfig = {
  runtimeDataModel: {} as RuntimeDataModel,
  previewFeatures: [],
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
        errorFormat: 'pretty',
        log: ['error'],
      },
      config,
    )

    validatePrismaClientOptions(
      {
        adapter: {} as any,
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

describe('comments option', () => {
  test('accepts valid array of functions', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        adapter: {} as any,
        comments: [() => ({}), () => ({ key: 'value' })],
      },
      config,
    )
  })

  test('accepts empty array', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        adapter: {} as any,
        comments: [],
      },
      config,
    )
  })

  test('accepts undefined', () => {
    expect.assertions(0)
    validatePrismaClientOptions(
      {
        adapter: {} as any,
        comments: undefined,
      },
      config,
    )
  })

  test('rejects non-array value', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          comments: 'not-an-array' as any,
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid value "not-an-array" for "comments" provided to PrismaClient constructor. Expected an array of SQL commenter plugins.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('rejects object value', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          comments: { plugin: () => ({}) } as any,
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid value {} for "comments" provided to PrismaClient constructor. Expected an array of SQL commenter plugins.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('rejects non-function elements', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          comments: [() => ({}), 'not-a-function'] as any,
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid value at index 1 for "comments" provided to PrismaClient constructor. Each plugin must be a function.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('rejects null elements', () => {
    expect(() =>
      validatePrismaClientOptions(
        {
          adapter: {} as any,
          comments: [null] as any,
        },
        config,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Invalid value at index 0 for "comments" provided to PrismaClient constructor. Each plugin must be a function.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })
})
