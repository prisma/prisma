import { FileMap } from '../types'
import indent from 'indent-string'
import path from 'path'
import { cyan } from 'kleur'
import { printMigrationId } from './printMigrationId'

export function printFiles(printPath: string, files: FileMap) {
  const fileNames = Object.keys(files)
  const folders = printPath.split('/')
  const deepFolder = folders[1]

  return `\
${folders[0]}/
  └─ ${`${printMigrationId(deepFolder)}/`}
${indent(fileNames.map(f => `└─ ${f}`).join('\n'), 4)}`
}
