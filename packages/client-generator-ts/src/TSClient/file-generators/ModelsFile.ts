import { GenerateContext } from '../GenerateContext'

const jsDocHeader = `/*
 * This is a barrel export file for all models and their related types.
 *
 * 🟢 You can import this file directly.
 */
`

export function createModelsFile(context: GenerateContext, modelsNames: string[]): string {
  const exports = modelsNames.map((m) => `export type * from './models/${context.importFileName(m)}'`)
  exports.push(`export type * from './${context.importFileName('commonInputTypes')}'`)
  return jsDocHeader + exports.join('\n')
}
