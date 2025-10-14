import type { SqlDriverFactory } from '@prisma/driver-utils'
import { isPrismaPostgres } from '@prisma/internals'

/**
 * - `copyEngine === false` implies Prisma Accelerate usage
 * - If we detect Prisma Accelerate usage, we want to recommend using `--no-engine` in production.
 * - Driver Adapters should NOT be used with `prisma generate `--no-engine`
 * - Driver Adapters should NOT be imported from `@prisma/client/edge` endpoint
 * - Accelerate should NOT be used with Driver Adapters
 * - Prisma Postgres can be used with either Accelerate or Driver Adapters
 */

type WarningDiagnostic = { _tag: 'warning'; value: [key: string, message: string, ...args: unknown[]] }
type ErrorDiagnostic = { _tag: 'error'; value: string }

type ValidateEngineInstanceConfigParams = {
  url?: string
  driver?: SqlDriverFactory
  copyEngine: boolean

  /**
   * The type indicates that {@link validateEngineInstanceConfig} only cares about
   * the {@link targetBuildType} being `edge`. If all other input options are fixed,
   * changing the value of this param to something else will exhibit no different
   * validation behavior.
   */
  targetBuildType: 'edge' | (string & {}) // typeof TARGET_BUILD_TYPE
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
 * @param driver The driver passed to the Prisma Client constructor
 * @param copyEngine Whether the engine was copied. `prisma generate --no-engine` implies `copyEngine: false`
 * @param targetBuildType The target build type
 */
export function validateEngineInstanceConfig({
  url,
  driver,
  copyEngine,
  targetBuildType,
}: ValidateEngineInstanceConfigParams): ValidateEngineInstanceConfigOutput {
  const warnings = [] as WarningDiagnostic[]
  const errors = [] as ErrorDiagnostic[]

  const pushWarning = (input: WarningDiagnostic['value']) => {
    warnings.push({ _tag: 'warning', value: input })
  }

  const pushError = (input: string[]) => {
    const value = input.join('\n')
    errors.push({ _tag: 'error', value })
  }

  const isUsingPrismaAccelerate = Boolean(url?.startsWith('prisma://'))
  const isUsingPrismaPostgres = isPrismaPostgres(url)
  const isUsingDriverAdapters = Boolean(driver)
  const isAccelerateUrlScheme = isUsingPrismaAccelerate || isUsingPrismaPostgres

  if (
    !isUsingDriverAdapters &&
    copyEngine &&
    isAccelerateUrlScheme &&
    targetBuildType !== 'client' &&
    targetBuildType !== 'wasm-compiler-edge'
  ) {
    pushWarning([
      'recommend--no-engine',
      'In production, we recommend using `prisma generate --no-engine` (See: `prisma generate --help`)',
    ])
  }

  const isAccelerateConfigured = isAccelerateUrlScheme || !copyEngine

  if (isUsingDriverAdapters && (isAccelerateConfigured || targetBuildType === 'edge')) {
    if (targetBuildType === 'edge') {
      pushError([
        `Prisma Client was configured to use the \`driver\` option but it was imported via its \`/edge\` endpoint.`,
        `Please either remove the \`/edge\` endpoint or remove the \`driver\` from the Prisma Client constructor.`,
      ])
    } else if (isAccelerateUrlScheme) {
      pushError([
        `You've provided both a driver and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.`,
        `Please provide either a driver with a direct database URL or an Accelerate URL and no driver.`,
      ])
    } else if (!copyEngine) {
      pushError([
        `Prisma Client was configured to use the \`driver\` option but \`prisma generate\` was run with \`--no-engine\`.`,
        `Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the driver.`,
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
