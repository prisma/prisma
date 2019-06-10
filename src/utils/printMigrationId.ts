import chalk from 'chalk'

export function printMigrationId(migrationId: string) {
  const words = migrationId.split('-')
  if (words.length === 1) {
    return chalk.bold(migrationId)
  }
  return words.slice(0, words.length - 1).join('-') + `-${chalk.bold(words.slice(-1)[0])}`
}
