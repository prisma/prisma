import type { FileMap } from '../types'
import indent from 'indent-string'
import { printMigrationId } from './printMigrationId'

export function printFiles(printPath: string, files: FileMap): string {
  const fileNames = Object.keys(files)
  const folders = printPath.split('/')
  const deepFolder = folders[1]

  return `\
${folders[0]}/
  └─ ${`${printMigrationId(deepFolder)}/`}
${indent(fileNames.map((f) => `└─ ${f}`).join('\n'), 4)}`
}

export function printFilesFromMigrationIds(
  directory: string,
  migrationIds: string[],
  files: FileMap,
): string {
  const fileNames = Object.keys(files)

  let message = `\
${directory}/`

  migrationIds.forEach((migrationId) => {
    message += `\n  └─ ${printMigrationId(migrationId)}/
${indent(fileNames.map((f) => `└─ ${f}`).join('\n'), 4)}`
  })

  return message
}
