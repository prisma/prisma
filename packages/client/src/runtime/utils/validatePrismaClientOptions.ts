import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import leven from 'js-levenshtein'

import { PrismaClientConstructorValidationError } from '../core/errors/PrismaClientConstructorValidationError'
import { getPreviewFeatures } from '../core/init/getPreviewFeatures'
import type { ErrorFormat, GetPrismaClientConfig, LogLevel, PrismaClientOptions } from '../getPrismaClient'

const knownProperties = [
  'datasources',
  'datasourceUrl',
  'errorFormat',
  'adapter',
  'log',
  'transactionOptions',
  '__internal',
]
const errorFormats: ErrorFormat[] = ['pretty', 'colorless', 'minimal']
const logLevels: LogLevel[] = ['info', 'query', 'warn', 'error']

/**
 * Subset of `GetPrismaClientConfig` which is used during validation.
 * Feel free to allow more properties when necessary but don't forget to add
 * them in the mock config in `validatePrismaClientOptions.test.ts`.
 */
type ClientConfig = Pick<GetPrismaClientConfig, 'datasourceNames' | 'generator'>

const validators: {
  [K in keyof PrismaClientOptions]-?: (option: PrismaClientOptions[K], config: ClientConfig) => void
} = {
  datasources: (options, { datasourceNames }) => {
    if (!options) {
      return
    }
    if (typeof options !== 'object' || Array.isArray(options)) {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${JSON.stringify(options)} for "datasources" provided to PrismaClient constructor`,
      )
    }

    for (const [key, value] of Object.entries(options)) {
      if (!datasourceNames.includes(key)) {
        const didYouMean =
          getDidYouMean(key, datasourceNames) || ` Available datasources: ${datasourceNames.join(', ')}`
        throw new PrismaClientConstructorValidationError(
          `Unknown datasource ${key} provided to PrismaClient constructor.${didYouMean}`,
        )
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new PrismaClientConstructorValidationError(
          `Invalid value ${JSON.stringify(options)} for datasource "${key}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`,
        )
      }
      if (value && typeof value === 'object') {
        for (const [key1, value1] of Object.entries(value)) {
          if (key1 !== 'url') {
            throw new PrismaClientConstructorValidationError(
              `Invalid value ${JSON.stringify(options)} for datasource "${key}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`,
            )
          }
          if (typeof value1 !== 'string') {
            throw new PrismaClientConstructorValidationError(
              `Invalid value ${JSON.stringify(value1)} for datasource "${key}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`,
            )
          }
        }
      }
    }
  },
  adapter: (adapter, config) => {
    if (adapter === null) {
      return
    }

    if (adapter === undefined) {
      throw new PrismaClientConstructorValidationError(
        `"adapter" property must not be undefined, use null to conditionally disable driver adapters.`,
      )
    }
    const previewFeatures = getPreviewFeatures(config)
    if (!previewFeatures.includes('driverAdapters')) {
      throw new PrismaClientConstructorValidationError(
        '"adapter" property can only be provided to PrismaClient constructor when "driverAdapters" preview feature is enabled.',
      )
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      throw new PrismaClientConstructorValidationError(
        `Cannot use a driver adapter with the "binary" Query Engine. Please use the "library" Query Engine.`,
      )
    }
  },
  datasourceUrl: (options) => {
    if (typeof options !== 'undefined' && typeof options !== 'string') {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${JSON.stringify(options)} for "datasourceUrl" provided to PrismaClient constructor.
Expected string or undefined.`,
      )
    }
  },
  errorFormat: (options) => {
    if (!options) {
      return
    }
    if (typeof options !== 'string') {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${JSON.stringify(options)} for "errorFormat" provided to PrismaClient constructor.`,
      )
    }
    if (!errorFormats.includes(options as ErrorFormat)) {
      const didYouMean = getDidYouMean(options, errorFormats)
      throw new PrismaClientConstructorValidationError(
        `Invalid errorFormat ${options} provided to PrismaClient constructor.${didYouMean}`,
      )
    }
  },
  log: (options) => {
    if (!options) {
      return
    }
    if (!Array.isArray(options)) {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${JSON.stringify(options)} for "log" provided to PrismaClient constructor.`,
      )
    }

    function validateLogLevel(level: any) {
      if (typeof level === 'string') {
        if (!logLevels.includes(level as LogLevel)) {
          const didYouMean = getDidYouMean(level, logLevels)
          throw new PrismaClientConstructorValidationError(
            `Invalid log level "${level}" provided to PrismaClient constructor.${didYouMean}`,
          )
        }
      }
    }

    for (const option of options) {
      validateLogLevel(option)

      const logValidators = {
        level: validateLogLevel,
        emit: (value) => {
          const emits = ['stdout', 'event']
          if (!emits.includes(value)) {
            const didYouMean = getDidYouMean(value, emits)
            throw new PrismaClientConstructorValidationError(
              `Invalid value ${JSON.stringify(
                value,
              )} for "emit" in logLevel provided to PrismaClient constructor.${didYouMean}`,
            )
          }
        },
      }

      if (option && typeof option === 'object') {
        for (const [key, value] of Object.entries(option)) {
          if (logValidators[key]) {
            logValidators[key](value)
          } else {
            throw new PrismaClientConstructorValidationError(
              `Invalid property ${key} for "log" provided to PrismaClient constructor`,
            )
          }
        }
      }
    }
  },
  transactionOptions: (options: any) => {
    if (!options) {
      return
    }

    const maxWait = options.maxWait
    if (maxWait != null && maxWait <= 0) {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${maxWait} for maxWait in "transactionOptions" provided to PrismaClient constructor. maxWait needs to be greater than 0`,
      )
    }

    const timeout = options.timeout
    if (timeout != null && timeout <= 0) {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${timeout} for timeout in "transactionOptions" provided to PrismaClient constructor. timeout needs to be greater than 0`,
      )
    }
  },
  __internal: (value) => {
    if (!value) {
      return
    }
    const knownKeys = ['debug', 'engine', 'configOverride']
    if (typeof value !== 'object') {
      throw new PrismaClientConstructorValidationError(
        `Invalid value ${JSON.stringify(value)} for "__internal" to PrismaClient constructor`,
      )
    }
    for (const [key] of Object.entries(value)) {
      if (!knownKeys.includes(key)) {
        const didYouMean = getDidYouMean(key, knownKeys)
        throw new PrismaClientConstructorValidationError(
          `Invalid property ${JSON.stringify(key)} for "__internal" provided to PrismaClient constructor.${didYouMean}`,
        )
      }
    }
    // TODO: Add more validation here
    // but as this is an internal, non user-facing api, it's not urgent
  },
}

export function validatePrismaClientOptions(options: PrismaClientOptions, config: ClientConfig) {
  for (const [key, value] of Object.entries(options)) {
    if (!knownProperties.includes(key)) {
      const didYouMean = getDidYouMean(key, knownProperties)
      throw new PrismaClientConstructorValidationError(
        `Unknown property ${key} provided to PrismaClient constructor.${didYouMean}`,
      )
    }
    validators[key](value, config)
  }

  if (options.datasourceUrl && options.datasources) {
    throw new PrismaClientConstructorValidationError(
      'Can not use "datasourceUrl" and "datasources" options at the same time. Pick one of them',
    )
  }
}

function getDidYouMean(str: string, options: string[]): string {
  if (options.length === 0) {
    return ''
  }

  if (typeof str !== 'string') {
    return ''
  }

  const alternative = getAlternative(str, options)
  if (!alternative) {
    return ''
  }

  return ` Did you mean "${alternative}"?`
}

function getAlternative(str: string, options: string[]): null | string {
  if (options.length === 0) {
    return null
  }

  const optionsWithDistances = options.map((value) => ({
    value,
    distance: leven(str, value),
  }))

  optionsWithDistances.sort((a, b) => {
    return a.distance < b.distance ? -1 : 1
  })

  const bestAlternative = optionsWithDistances[0]
  if (bestAlternative.distance < 3) {
    return bestAlternative.value
  }

  return null
}
