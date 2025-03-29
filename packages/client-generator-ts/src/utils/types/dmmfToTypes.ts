import type * as DMMF from '@prisma/dmmf'

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
    activeProvider: '' as any,
    binaryPaths: {},
    generator: {
      binaryTargets: [],
      config: {},
      name: 'prisma-client-ts',
      output: null,
      provider: { value: 'prisma-client-ts', fromEnvVar: null },
      previewFeatures: [],
      isCustomOutput: false,
      sourceFilePath: 'schema.prisma',
    },
    datamodel: '',
    browser: false,
    deno: false,
    edge: false,
    envPaths: {
      rootEnvPath: null,
      schemaEnvPath: undefined,
    },
    target: 'nodejs',
  }).toTS()
}
