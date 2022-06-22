import { isError } from '@prisma/internals'
import leven from 'js-levenshtein'

import type { ErrorFormat, LogLevel, PrismaClientOptions } from '../getPrismaClient'
import { PrismaClientConstructorValidationError } from '../query'

const knownProperties = ['datasources', 'errorFormat', 'log', '__internal', 'rejectOnNotFound']
const errorFormats: ErrorFormat[] = ['pretty', 'colorless', 'minimal']
const logLevels: LogLevel[] = ['info', 'query', 'warn', 'error']

const validators = {
  datasources: (options: any, datasourceNames: string[]) => {
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
        const didYouMean = getDidYouMean(key, datasourceNames) || `Available datasources: ${datasourceNames.join(', ')}`
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
  errorFormat: (options: any) => {
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
  log: (options: any) => {
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
  __internal: (value) => {
    if (!value) {
      return
    }
    const knownKeys = ['debug', 'hooks', 'engine', 'measurePerformance']
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
  rejectOnNotFound: (value) => {
    if (!value) {
      return
    }
    if (isError(value) || typeof value === 'boolean' || typeof value === 'object' || typeof value === 'function') {
      return value
    }
    throw new PrismaClientConstructorValidationError(
      `Invalid rejectOnNotFound expected a boolean/Error/{[modelName: Error | boolean]} but received ${JSON.stringify(
        value,
      )}`,
    )
  },
}

export function validatePrismaClientOptions(options: PrismaClientOptions, datasourceNames: string[]) {
  for (const [key, value] of Object.entries(options)) {
    if (!knownProperties.includes(key)) {
      const didYouMean = getDidYouMean(key, knownProperties)
      throw new PrismaClientConstructorValidationError(
        `Unknown property ${key} provided to PrismaClient constructor.${didYouMean}`,
      )
    }
    validators[key](value, datasourceNames)
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
