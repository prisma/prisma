import chalk from 'chalk'

export function printMigrationId(migrationId: string) {
  const words = migrationId.split('-')
  if (words.length === 1) {
    return chalk.cyan.bold(migrationId)
  }
  return `${words[0]}-${chalk.cyan.bold(words.slice(1).join('-'))}`
}
