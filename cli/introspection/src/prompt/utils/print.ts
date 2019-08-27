import chalk from 'chalk'

export function printError(text) {
  return chalk.bold.bgRed(' ERROR ') + ' ' + chalk.red(text)
}

export function printFix(text) {
  return chalk.bgWhite.black.bold(' FIX ') + ' ' + text
}

const beautifyMap = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
}

export function beautifyLanguage(language: string): string {
  return beautifyMap[language] || language
}
