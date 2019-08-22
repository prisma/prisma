import chalk from 'chalk'

export function printError(text) {
  return chalk.bold.bgRed(' ERROR ') + ' ' + chalk.red(text)
}

export function printFix(text) {
  return chalk.bgWhite.black.bold(' FIX ') + ' ' + text
}
