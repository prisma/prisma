import { bold, cyan } from 'kleur/colors'

export function printMigrationId(migrationId: string): string {
  const words = migrationId.split('_')
  if (words.length === 1) {
    return cyan(bold(migrationId))
  }
  return `${words[0]}_${cyan(bold(words.slice(1).join('_')))}`
}

export function printMigrationIds(migrationIds: string[]): string {
  return migrationIds.reduce((acc, migrationId) => {
    return acc + '- ' + printMigrationId(migrationId) + '\n'
  }, '')
}
