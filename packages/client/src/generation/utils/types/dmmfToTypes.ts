import type { DMMF } from '../../../runtime/dmmf-types'
import { TSClient } from '../../TSClient/TSClient'

/**
 * @internal
 *
 * @privateRemarks Used by, for example, the PDP to avoid child process calls to the CLI.
 */
export function dmmfToTypes(document: DMMF.Document) {
  return new TSClient({
    document: document,
    datasources: [],
    projectRoot: '',
    clientVersion: '',
    engineVersion: '',
    runtimeDir: '',
    runtimeName: '',
    schemaPath: '',
    outputDir: '',
    activeProvider: '',
    dataProxy: false,
  }).toTS()
}
