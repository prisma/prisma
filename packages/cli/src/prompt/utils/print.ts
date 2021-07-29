import chalk from 'chalk'

export function printError(text): string {
  return chalk.bold.bgRed(' ERROR ') + ' ' + chalk.red(text)
}
