import crypto from 'node:crypto'
import path from 'node:path'

import { GetPrismaClientConfig } from '@prisma/client-common'
import { BinaryTarget, ClientEngineType, getClientEngineType, pathToPosix } from '@prisma/internals'
import ciInfo from 'ci-info'

import { buildDebugInitialization } from '../../utils/buildDebugInitialization'
import { buildDirname } from '../../utils/buildDirname'
import { buildRuntimeDataModel } from '../../utils/buildDMMF'
import { buildGetWasmModule } from '../../utils/buildGetWasmModule'
import { buildInjectableEdgeEnv } from '../../utils/buildInjectableEdgeEnv'
import { buildNFTAnnotations } from '../../utils/buildNFTAnnotations'
import { GenerateContext } from '../GenerateContext'
import { PrismaClientClass } from '../PrismaClient'
import { TSClientOptions } from '../TSClient'

export function createClassFile(context: GenerateContext, options: TSClientOptions): string {
  const prismaClientClass = new PrismaClientClass(context, options.datasources, options.outputDir, options.runtimeName)

  const {
    edge,
    binaryPaths,
    generator,
    outputDir,
    datamodel: inlineSchema,
    runtimeBase,
    runtimeName,
    datasources,
    copyEngine = true,
    target,
    activeProvider,
    moduleFormat,
  } = options

  // This ensures that any engine override is propagated to the generated clients config
  const clientEngineType = getClientEngineType(generator)
  generator.config.engineType = clientEngineType

  const binaryTargets =
    clientEngineType === ClientEngineType.Library
      ? (Object.keys(binaryPaths.libqueryEngine ?? {}) as BinaryTarget[])
      : (Object.keys(binaryPaths.queryEngine ?? {}) as BinaryTarget[])

  const inlineSchemaHash = crypto
    .createHash('sha256')
    .update(Buffer.from(inlineSchema, 'utf8').toString('base64'))
    .digest('hex')

  const datasourceFilePath = datasources[0].sourceFilePath
  const config: GetPrismaClientConfig = {
    generator,
    relativePath: pathToPosix(path.relative(outputDir, path.dirname(datasourceFilePath))),
    clientVersion: options.clientVersion,
    engineVersion: options.engineVersion,
    datasourceNames: datasources.map((d) => d.name),
    activeProvider: options.activeProvider,
    postinstall: options.postinstall,
    ciName: ciInfo.name ?? undefined,
    inlineDatasources: datasources.reduce((acc, ds) => {
      return (acc[ds.name] = { url: ds.url }), acc
    }, {} as GetPrismaClientConfig['inlineDatasources']),
    inlineSchema,
    inlineSchemaHash,
    copyEngine,
    runtimeDataModel: { models: {}, enums: {}, types: {} },
    dirname: '',
  }

  // get relative output dir for it to be preserved even after bundling, or
  // being moved around as long as we keep the same project dir structure.
  const relativeOutdir = path.relative(process.cwd(), outputDir)

  const clientConfig = `
const config: runtime.GetPrismaClientConfig = ${JSON.stringify(config, null, 2)}
${buildDirname(edge)}
${buildRuntimeDataModel(context.dmmf.datamodel, runtimeName)}
${buildGetWasmModule({ component: 'engine', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildGetWasmModule({ component: 'compiler', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildInjectableEdgeEnv(edge, datasources)}
${buildDebugInitialization(edge)}
${buildNFTAnnotations(edge || !copyEngine, clientEngineType, binaryTargets, relativeOutdir)}
`

  return `
import path from 'node:path'

import * as runtime from '@prisma/client/runtime/library';
import type * as Prisma from './common';
  
${clientConfig}

${prismaClientClass.toTSWithoutNamespace()}
`
}
