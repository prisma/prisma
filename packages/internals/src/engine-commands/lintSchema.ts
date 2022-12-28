import chalk from 'chalk'

import { logger } from '..'
import { ErrorArea, RustPanic } from '../panic'
import { prismaFmt } from '../wasm'

type LintSchemaParams = { schema: string }

type LintDiagnosticBase = {
  start: number
  end: number
  text: string
}

// nit: we could configure Serde to use camelCase these fields in Rust's JSON serialization
export type LintWarning = { is_warning: true } & LintDiagnosticBase
export type LintError = { is_warning: false } & LintDiagnosticBase
export type LintDiagnostic = LintWarning | LintError

/**
 * Diagnose the given schema, returning a list either errors or warnings.
 * This function may panic, but it won't throw any standard error.
 */
export function lintSchema({ schema }: LintSchemaParams): LintDiagnostic[] {
  const lintResult = prismaFmt.lint(schema)
  const lintDiagnostics = JSON.parse(lintResult) as LintDiagnostic[]
  return lintDiagnostics
}

export function handleLintPanic<T>(tryCb: () => T, { schema }: LintSchemaParams) {
  try {
    return tryCb()
  } catch (e: unknown) {
    const wasmError = e as Error
    throw new RustPanic(
      /* message */ wasmError.message,
      /* rustStack */ wasmError.stack || 'NO_BACKTRACE',
      /* request */ '@prisma/prisma-fmt-wasm lint',
      ErrorArea.FMT_CLI,
      undefined,
      schema,
    )
  }
}

export function getLintWarnings(lintDiagnostics: LintDiagnostic[]): LintWarning[] {
  return lintDiagnostics.filter(isWarning)
}

/*
 * Return warnings as a string, if any. So we can show them to the user.
 *
 * Note:
 * - We don't get a nice warning message output with colors and line numbers for free, as we would with errors detected by `getDmmf`.
 *   I.e., there's not such thing for warnings out of the box as the following:
 *     -->  schema.prisma:18
 *      |
 *   17 |   id     Int      @id
 *   18 |   user   SomeUser @relation(fields: [userId], references: [id], onUpdate: SetNull, onDelete: SetNull)
 *   19 |   userId Int      @unique
 *      |
 */
export function getLintWarningsAsText(lintDiagnostics: LintDiagnostic[]): string {
  const lintWarnings = getLintWarnings(lintDiagnostics)

  const textLines: string[] = []
  if (lintWarnings.length > 0) {
    textLines.push(chalk.yellow(`\nPrisma schema warning${lintWarnings.length > 1 ? 's' : ''}:`))
    for (const warning of lintWarnings) {
      textLines.push(warningToString(warning))
    }
  }

  return textLines.join('\n')
}

/**
 * Given a Prisma schema, display validation warnings if there are any and warnings
 * are globally enabled in `logger`.
 */
export function maybePrintValidationWarnings({ schema }: LintSchemaParams) {
  const { lintDiagnostics } = handleLintPanic(
    () => {
      // the only possible error here is a Rust panic
      const lintDiagnostics = lintSchema({ schema })
      return { lintDiagnostics }
    },
    { schema },
  )
  const lintWarnings = getLintWarningsAsText(lintDiagnostics)
  if (logger.should.warn() && lintWarnings.length > 0) {
    // Output warnings to stderr
    console.warn(lintWarnings)
  }
}

export function warningToString(warning: LintDiagnostic): string {
  return chalk.yellow(`- ${warning.text}`)
}

function isWarning(diagnostic: LintDiagnostic): diagnostic is LintWarning {
  return diagnostic.is_warning
}
