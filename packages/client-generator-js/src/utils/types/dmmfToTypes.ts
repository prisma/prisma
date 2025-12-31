import path from 'node:path'

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
    runtimeName: 'client',
    runtimeSourcePath: path.join(__dirname, '../../../runtime'),
    schemaPath: '',
    outputDir: '',
    activeProvider: '' as any,
    binaryPaths: {},
    generator: {
      binaryTargets: [],
      config: {},
      name: 'prisma-client-js',
      output: null,
      provider: { value: 'prisma-client-js', fromEnvVar: null },
      previewFeatures: [],
      isCustomOutput: false,
      sourceFilePath: 'schema.prisma',
    },
    datamodel: '',
    browser: false,
    edge: false,
    wasm: false,
    compilerBuild: 'fast',
  }).toTS()
}
