import chalk from 'chalk'
import { ConnectorType } from '@prisma/generator-helper'

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

export function prettyDb(type: ConnectorType) {
  switch (type) {
    case 'mysql': {
      return 'MySQL'
    }
    case 'postgresql': {
      return 'PostgreSQL'
    }
  }
  return type
}
