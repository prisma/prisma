import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import { isPrismaPostgres } from '@prisma/internals'

/**
 * - Accelerate should NOT be used with Driver Adapters
 * - Prisma Postgres can be used with either Accelerate or Driver Adapters
 */

type WarningDiagnostic = { _tag: 'warning'; value: [key: string, message: string, ...args: unknown[]] }
type ErrorDiagnostic = { _tag: 'error'; value: string }

type ValidateEngineInstanceConfigParams = {
  url?: string
  adapter?: SqlDriverAdapterFactory
}

type WithDiagnostics =
  | {
      ok: true

      diagnostics: {
        warnings: WarningDiagnostic[]
        errors?: never
      }
    }
  | {
      ok: false

      diagnostics: {
        warnings: WarningDiagnostic[]
        errors: [ErrorDiagnostic, ...ErrorDiagnostic[]]
      }
    }

type ValidateEngineInstanceConfigOutput = WithDiagnostics & {
  isUsing: {
    accelerate: boolean
    ppg: boolean
    driverAdapters: boolean
  }
}

/**
 * Validates the engine instance configuration, without side effects.
 * @param url The URL passed to the Prisma Client constructor
 * @param adapter The driver adapter passed to the Prisma Client constructor
 * @param targetBuildType The target build type
 */
export function validateEngineInstanceConfig({
  url,
  adapter,
}: ValidateEngineInstanceConfigParams): ValidateEngineInstanceConfigOutput {
  const warnings = [] as WarningDiagnostic[]
  const errors = [] as ErrorDiagnostic[]

  const pushError = (input: string[]) => {
    const value = input.join('\n')
    errors.push({ _tag: 'error', value })
  }

  const isUsingPrismaAccelerate = Boolean(url?.startsWith('prisma://'))
  const isUsingPrismaPostgres = isPrismaPostgres(url)
  const isUsingDriverAdapters = Boolean(adapter)
  const isAccelerateUrlScheme = isUsingPrismaAccelerate || isUsingPrismaPostgres

  const isAccelerateConfigured = isAccelerateUrlScheme

  if (isUsingDriverAdapters && isAccelerateConfigured) {
    if (isAccelerateUrlScheme) {
      pushError([
        `You've provided both a driver adapter and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.`,
        `Please provide either a driver adapter with a direct database URL or an Accelerate URL and no driver adapter.`,
      ])
    }
  }

  const isUsing = {
    accelerate: isAccelerateConfigured,
    ppg: isUsingPrismaPostgres,
    driverAdapters: isUsingDriverAdapters,
  }

  function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
    return arr.length > 0
  }

  if (isNonEmptyArray(errors)) {
    return {
      ok: false,
      diagnostics: {
        warnings,
        errors,
      },
      isUsing,
    }
  }

  return {
    ok: true,
    diagnostics: { warnings },
    isUsing,
  }
}
