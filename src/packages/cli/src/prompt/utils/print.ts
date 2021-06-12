import chalk from 'chalk'

export function printError(text): string {
  return chalk.bold.bgRed(' ERROR ') + ' ' + chalk.red(text)
}

export function printWarning(text): string {
  return chalk.bold.black.bgYellow(' WARNING ') + ' ' + chalk.yellow(text)
}
