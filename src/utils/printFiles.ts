import { FileMap } from '../types'
import indent from 'indent-string'
import path from 'path'
import { cyan } from 'kleur'

export function printFiles(folder: string, files: FileMap) {
  const fileNames = Object.keys(files)
  const deepFolder = path.dirname(fileNames[0])

  return `\
${folder}/
  └─ ${cyan(`${deepFolder}/`)}
${indent(fileNames.map(f => `└─ ${path.basename(f)}`).join('\n'), 4)}`
}
