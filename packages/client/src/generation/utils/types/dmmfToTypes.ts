import type { DMMF } from '../../../runtime/dmmf-types'
import { TSClient } from '../../TSClient/TSClient'

// Internal, used by the PDP not to need a call to the CLI
export function dmmfToTypes(document: DMMF.Document) {
  return new TSClient({
    document: document,
    datasources: [],
    projectRoot: '',
    clientVersion: '',
    engineVersion: '',
    runtimeDir: '',
    runtimeName: '',
    schemaDir: '',
    outputDir: '',
    activeProvider: '',
  }).toTS()
}
