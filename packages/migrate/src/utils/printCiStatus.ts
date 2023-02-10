import { hasCiVariable } from '@prisma/internals'
import chalk from 'chalk'

// CI environment detected: "GITHUB_ACTION" is set
export function printCiStatus(): void {
  const ciVariable = hasCiVariable()

  if (!ciVariable) return

  console.info(chalk.dim(`CI environment detected: "${ciVariable}" is set`))
}
