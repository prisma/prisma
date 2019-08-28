import chalk from 'chalk'
import { DatabaseType } from 'prisma-datamodel'

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

export function prettyDb(type: DatabaseType) {
  switch (type) {
    case DatabaseType.mysql: {
      return 'MySQL'
    }
    case DatabaseType.postgres: {
      return 'PostgreSQL'
    }
  }
  return type
}
