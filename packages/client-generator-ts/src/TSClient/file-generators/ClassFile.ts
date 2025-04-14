import crypto from 'node:crypto'
import path from 'node:path'

import { GetPrismaClientConfig } from '@prisma/client-common'
import { getClientEngineType, pathToPosix } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'
import ciInfo from 'ci-info'

import { buildDebugInitialization } from '../../utils/buildDebugInitialization'
import { buildDirname } from '../../utils/buildDirname'
import { buildRuntimeDataModel } from '../../utils/buildDMMF'
import { buildGetWasmModule } from '../../utils/buildGetWasmModule'
import { buildInjectableEdgeEnv } from '../../utils/buildInjectableEdgeEnv'
import { GenerateContext } from '../GenerateContext'
import { PrismaClientClass } from '../PrismaClient'
import { TSClientOptions } from '../TSClient'

const jsDocHeader = `/**
 * WARNING: This is an internal file that is subject to change!
 * 
 * 🛑 Under no circumstances should you import this file directly! 🛑
 * 
 * Please import the \`PrismaClient\` class from the \`client.ts\` file instead.
 */
`

export function createClassFile(context: GenerateContext, options: TSClientOptions): string {
  const imports = [
    ts.moduleImport(context.runtimeImport).asNamespace('runtime'),
    ts.moduleImport(context.importFileName(`./prismaNamespace`)).asNamespace('Prisma').typeOnly(),
  ].map((i) => ts.stringify(i))

  const prismaClientClass = new PrismaClientClass(context, options.runtimeName)

  return `${jsDocHeader}
${imports.join('\n')}
  
${clientConfig(context, options)}

${prismaClientClass.toTS()}
`
}

function clientConfig(context: GenerateContext, options: TSClientOptions) {
  const {
    edge,
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

  return `
const config: runtime.GetPrismaClientConfig = ${JSON.stringify(config, null, 2)}
${buildDirname(edge)}
${buildRuntimeDataModel(context.dmmf.datamodel, runtimeName)}
${buildGetWasmModule({ component: 'engine', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildGetWasmModule({ component: 'compiler', runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildInjectableEdgeEnv(edge, datasources)}
${buildDebugInitialization(edge)}
`
}
