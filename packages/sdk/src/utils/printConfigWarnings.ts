import chalk from 'chalk'

export function printConfigWarnings(warnings: string[]) {
  if (warnings && warnings.length > 0) {
    const message = warnings.map((warning) => `${chalk.yellow('warn')} ${warning}`).join('\n')
    console.warn(message)
  }
}
