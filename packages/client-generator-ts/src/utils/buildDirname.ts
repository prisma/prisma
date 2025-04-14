import { ModuleFormat } from '../module-format'

/**
 * Builds a `dirname` variable that holds the location of the generated client.
 */
export function buildDirname(edge: boolean, moduleFormat: ModuleFormat) {
  if (edge === true) {
    return `config.dirname = '/'`
  }

  if (moduleFormat === 'esm') {
    return `config.dirname = path.dirname(fileURLToPath(import.meta.url))`
  }

  return `config.dirname = __dirname`
}
