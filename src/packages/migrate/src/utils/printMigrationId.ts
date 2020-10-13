import chalk from 'chalk'

export function printMigrationId(migrationId: string): string {
  const words = migrationId.split('_')
  if (words.length === 1) {
    return chalk.cyan.bold(migrationId)
  }
  return `${words[0]}_${chalk.cyan.bold(words.slice(1).join('_'))}`
}

export function printMigrationIds(migrationIds: string[]): string {
  return migrationIds.reduce((acc, migrationId) => {
    return acc + '- ' + printMigrationId(migrationId) + '\n'
  }, '')
}
