import type { DMMF } from '../../dmmf-types'
import { TSClient } from '../../TSClient/TSClient'

/**
 * @internal
 * @remarks Used by, for example, the PDP to avoid child process calls to the CLI.
 */
export function dmmfToTypes(dmmf: DMMF.Document) {
  return new TSClient({
    dmmf,
    datasources: [],
    clientVersion: '',
    engineVersion: '',
    runtimeBase: '@prisma/client',
    runtimeName: 'library',
    schemaPath: '',
    outputDir: '',
    activeProvider: '',
    binaryPaths: {},
    generator: {} as any,
    datamodel: '',
    browser: false,
    deno: false,
    edge: false,
    indexWarning: false,
    reuseTypes: false,
    wasm: false,
  }).toTS()
}
