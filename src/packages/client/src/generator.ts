import { generatorHandler } from '@prisma/generator-helper'
import Debug from '@prisma/debug'
import { generateClient } from './generation/generateClient'
import { getDMMF } from './generation/getDMMF'
import { enginesVersion } from '@prisma/engines-version'
import path from "path";
import { highlightTS, link } from '@prisma/sdk';
import { externalToInternalDmmf } from './runtime/externalToInternalDmmf'
const debugEnabled = Debug.enabled('prisma-client:generator')

// As specced in https://github.com/prisma/specs/tree/master/generators

const pkg = require('../package.json')
const clientVersion = pkg.version

generatorHandler({
  onManifest() {
    return {
      defaultOutput: '@prisma/client', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/master/cli/sdk/src/getGenerators.ts
      prettyName: 'Prisma Client',
      requiresEngines: ['queryEngine'],
      version: clientVersion,
      requiresEngineVersion: enginesVersion
    }
  },
  async onGenerate(options) {
    if (debugEnabled) {
      console.log('__dirname', __dirname)
      console.log(eval(`__dirname`)) // tslint:disable-line
    }

    return generateClient({
      datamodel: options.datamodel,
      datamodelPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      outputDir: options.generator.output!,
      copyRuntime: Boolean(options.generator.config.copyRuntime),
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      transpile: true,
    })
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async onUseMessage(options) {
    const importPath = options?.generator?.isCustomOutput
        ? prefixRelativePathIfNecessary(
            path.relative(
                process.cwd(),
                options?.generator.output!,
            ),
        )
        : '@prisma/client'

    const instruction = String(highlightTS(`
import { PrismaClient } from '${importPath}'
// or const { PrismaClient } = require('${importPath}')

const prisma = new PrismaClient()`))

    return `You can now start using Prisma Client in your code:

\`\`\`
${instruction}
\`\`\`

Explore the full API: ${link('http://pris.ly/d/client')}`
  }
})

export { getDMMF, externalToInternalDmmf }

function prefixRelativePathIfNecessary(relativePath: string): string {
  if (relativePath.startsWith('..')) {
    return relativePath
  }

  return `./${relativePath}`
}