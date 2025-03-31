import type { FileMap } from '../../generateClient'
import { GenerateContext } from '../GenerateContext'

export function createModelsFile(context: GenerateContext, modelsFileMap: FileMap): string {
  return `
${Object.keys(modelsFileMap)
  .map((m) => `export type * from './models/${m}'`)
  .join('\n')}
`
}
