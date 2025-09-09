import path from 'node:path'

import { BinaryTarget, ClientEngineType, getClientEngineType } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'

import { ModuleFormat } from '../../module-format'
import { buildNFTAnnotations } from '../../utils/buildNFTAnnotations'
import { GenerateContext } from '../GenerateContext'
import { getPrismaClientClassDocComment } from '../PrismaClient'
import { TSClientOptions } from '../TSClient'

const jsDocHeader = `/*
 * This file should be your main import to use Prisma. Through it you get access to all the models, enums, and input types.
 *
 * 🟢 You can import this file directly.
 */
`

export function createClientFile(context: GenerateContext, options: TSClientOptions): string {
  const clientEngineType = getClientEngineType(options.generator)
  options.generator.config.engineType = clientEngineType

  const imports = [
    ts.moduleImport(context.runtimeImport).asNamespace('runtime'),
    ts.moduleImport(context.importFileName('./enums')).asNamespace('$Enums'),
    ts.moduleImport(context.importFileName('./internal/class')).asNamespace('$Class'),
    ts.moduleImport(context.importFileName('./internal/prismaNamespace')).asNamespace('Prisma'),
  ].map((i) => ts.stringify(i))

  const exports = [
    ts.moduleExportFrom(context.importFileName('./enums')).asNamespace('$Enums'),
    ts.moduleExportFrom(context.importFileName('./enums')),
    ts
      .moduleExport(
        ts
          .constDeclaration('PrismaClient')
          .setValue(ts.functionCall('$Class.getPrismaClientClass', [ts.namedValue('__dirname')])),
      )
      .setDocComment(getPrismaClientClassDocComment(context)),
    ts.moduleExport(
      ts
        .typeDeclaration(
          'PrismaClient',
          ts
            .namedType('$Class.PrismaClient')
            .addGenericArgument(ts.namedType('LogOpts'))
            .addGenericArgument(ts.namedType('OmitOpts'))
            .addGenericArgument(ts.namedType('ExtArgs')),
        )
        .addGenericParameter(
          ts.genericParameter('LogOpts').extends(ts.namedType('Prisma.LogLevel')).default(ts.neverType),
        )
        .addGenericParameter(
          ts
            .genericParameter('OmitOpts')
            .extends(ts.namedType('Prisma.PrismaClientOptions').subKey('omit'))
            .default(ts.namedType('Prisma.PrismaClientOptions').subKey('omit')),
        )
        .addGenericParameter(
          ts
            .genericParameter('ExtArgs')
            .extends(ts.namedType('runtime.Types.Extensions.InternalArgs'))
            .default(ts.namedType('runtime.Types.Extensions.DefaultArgs')),
        ),
    ),
  ].map((e) => ts.stringify(e))

  const modelExports = Object.values(context.dmmf.typeAndModelMap)
    .filter((model) => context.dmmf.outputTypeMap.model[model.name])
    .map((model) => {
      const docLines = model.documentation ?? ''
      const modelLine = `Model ${model.name}\n`
      const docs = `${modelLine}${docLines}`

      const modelTypeExport = ts
        .moduleExport(ts.typeDeclaration(model.name, ts.namedType(`Prisma.${model.name}Model`)))
        .setDocComment(ts.docComment(docs))

      return ts.stringify(modelTypeExport)
    })

  const binaryTargets =
    clientEngineType === ClientEngineType.Library
      ? (Object.keys(options.binaryPaths.libqueryEngine ?? {}) as BinaryTarget[])
      : (Object.keys(options.binaryPaths.queryEngine ?? {}) as BinaryTarget[])

  // get relative output dir for it to be preserved even after bundling, or
  // being moved around as long as we keep the same project dir structure.
  const relativeOutdir = path.relative(process.cwd(), options.outputDir)

  return `${jsDocHeader}
${buildPreamble(options.edge, options.moduleFormat)}
${imports.join('\n')}

${exports.join('\n')}
export { Prisma }

${buildNFTAnnotations(options.edge || !options.copyEngine, clientEngineType, binaryTargets, relativeOutdir)}

${modelExports.join('\n')}
`
}

function buildPreamble(edge: boolean, moduleFormat: ModuleFormat): string {
  if (edge) {
    return `\
globalThis['__dirname'] = '/'
`
  }

  let preamble = `\
import * as process from 'node:process'
import * as path from 'node:path'
`

  if (moduleFormat === 'esm') {
    preamble += `\
import { fileURLToPath } from 'node:url'
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))
`
  }

  return preamble
}
