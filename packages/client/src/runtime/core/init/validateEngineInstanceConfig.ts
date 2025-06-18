import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import { isPrismaPostgres } from '@prisma/internals'

/**
 * - `copyEngine === false` implies Prisma Accelerate usage
 * - If we detect Prisma Accelerate usage, we want to recommend using `--no-engine` in production.
 * - Driver Adapters should NOT be used with `prisma generate `--no-engine`
 * - Driver Adapters should NOT be imported from `@prisma/client/edge` endpoint
 * - Accelerate should NOT be used with Driver Adapters
 * - Prisma Postgres can be used with either Accelerate or Driver Adapters
 */

type WarningDiagnostic = { _tag: 'warning', value: [key: string, message: string, ...args: unknown[]] }
type ErrorDiagnostic = { _tag: 'error', value: string }

type ValidateEngineInstanceConfigParams = {
  url?: string
  adapter?: SqlDriverAdapterFactory
  copyEngine: boolean
  targetBuildType: 'edge' | typeof TARGET_BUILD_TYPE //  (string & {})
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

export function validateEngineInstanceConfig(
  { url, adapter, copyEngine, targetBuildType }: ValidateEngineInstanceConfigParams,
): ValidateEngineInstanceConfigOutput {
  const warnings = [] as WarningDiagnostic[]
  const errors = [] as ErrorDiagnostic[]

  const pushWarning = (input: WarningDiagnostic['value']) => {
    warnings.push({ _tag: 'warning', value: input })
  }

  const pushError = (input: string[]) => {
    const value = input.join('\n')
    errors.push({ _tag: 'error', value })
  }
  
  const isUsingPrismaAccelerate = Boolean(url?.startsWith('prisma://')) || !copyEngine
  const isUsingPrismaPostgres = isPrismaPostgres(url)
  const isUsingDriverAdapters = Boolean(adapter)
  const isCompatibleWithPrismaAccelerate = isUsingPrismaAccelerate || isUsingPrismaPostgres
  
  if (!isUsingDriverAdapters && (copyEngine && isCompatibleWithPrismaAccelerate)) {
    pushWarning([
      'recommend--no-engine',
      'In production, we recommend using `prisma generate --no-engine` (See: `prisma generate --help`)',
    ])
  }
  
  if (isUsingDriverAdapters && (isCompatibleWithPrismaAccelerate || targetBuildType === 'edge')) {
    if (targetBuildType === 'edge') {
      pushError([
        `Prisma Client was configured to use the \`adapter\` option but it was imported via its \`/edge\` endpoint.`,
        `Please either remove the \`/edge\` endpoint or remove the \`adapter\` from the Prisma Client constructor.`,
      ])
    } else if (!copyEngine) {
      pushError([
        `Prisma Client was configured to use the \`adapter\` option but \`prisma generate\` was run with \`--no-engine\`.`,
        `Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the adapter.`,
      ])
    } else if (isUsingPrismaAccelerate) {
      pushError([
        `Prisma Client was configured to use the \`adapter\` option but the URL was a \`prisma://\` URL.`,
        `Please either use the \`prisma://\` URL or remove the \`adapter\` from the Prisma Client constructor.`,
      ])
    } else if (!isUsingPrismaPostgres) {
      pushError([
        'Prisma Client was configured to use both the `adapter` and Accelerate, please chose one.',
      ])
    }
  }

  const isUsing = {
    accelerate: isUsingPrismaAccelerate,
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
