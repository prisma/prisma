import path from 'node:path'

import { GetPrismaClientConfig } from '@prisma/client-common'
import { pathToPosix } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'
import ciInfo from 'ci-info'

import { buildDebugInitialization } from '../../utils/buildDebugInitialization'
import { buildRuntimeDataModel } from '../../utils/buildDMMF'
import { buildInlineDatasources } from '../../utils/buildInlineDatasources'
import { buildGetWasmModule } from '../../utils/wasm'
import { GenerateContext } from '../GenerateContext'
import { PrismaClientClass } from '../PrismaClient'
import { TSClientOptions } from '../TSClient'

const jsDocHeader = `/*
 * WARNING: This is an internal file that is subject to change!
 *
 * 🛑 Under no circumstances should you import this file directly! 🛑
 *
 * Please import the \`PrismaClient\` class from the \`client.ts\` file instead.
 */
`

export function createClassFile(context: GenerateContext, options: TSClientOptions): string {
  const imports: ts.BasicBuilder[] = [
    ts.moduleImport(context.runtimeImport).asNamespace('runtime'),
    ts.moduleImport(context.importFileName(`./prismaNamespace`)).asNamespace('Prisma').typeOnly(),
  ]

  const stringifiedImports = imports.map((i) => ts.stringify(i))

  const prismaClientClass = new PrismaClientClass(context, options.runtimeName)

  return `${jsDocHeader}
${stringifiedImports.join('\n')}

${clientConfig(context, options)}

${prismaClientClass.toTS()}

export function getPrismaClientClass(dirname: string): PrismaClientConstructor {
  config.dirname = dirname
  return runtime.getPrismaClient(config) as unknown as PrismaClientConstructor
}
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
    target,
    activeProvider,
    moduleFormat,
  } = options

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
    inlineDatasources: buildInlineDatasources(datasources),
    inlineSchema,
    runtimeDataModel: { models: {}, enums: {}, types: {} },
    dirname: '',
  }

  return `
const config: runtime.GetPrismaClientConfig = ${JSON.stringify(config, null, 2)}
${buildRuntimeDataModel(context.dmmf.datamodel, runtimeName)}
${buildGetWasmModule({ runtimeBase, runtimeName, target, activeProvider, moduleFormat })}
${buildDebugInitialization(edge)}
`
}
