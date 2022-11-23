import chalk from 'chalk'

import { prismaFmt } from '../wasm'

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
export function lintSchema(schema: string): LintDiagnostic[] {
  const lintResult = prismaFmt.lint(schema)
  const lintDiagnostics = JSON.parse(lintResult) as LintDiagnostic[]
  return lintDiagnostics
}

export function getLintWarnings(lintDiagnostics: LintDiagnostic[]): LintWarning[] {
  return lintDiagnostics.filter(isWarning)
}

export function warningToString(warning: LintDiagnostic): string {
  return chalk.yellow(`- ${warning.text}`)
}

function isWarning(diagnostic: LintDiagnostic): diagnostic is LintWarning {
  return diagnostic.is_warning
}
