import { CompiledGeneratorDefinition, Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import { getRawDMMF } from '@prisma/photon'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { LiftEngine } from '../../LiftEngine'
import { runGeneratorBinary } from './runGeneratorBinary'
// import { generateInThread } from '../generateInThread'

const didYouMeanMap = {
  javascript: 'photonjs',
  typescript: 'photonjs',
  'photon-js': 'photonjs',
  photon: 'photonjs',
}

export async function getCompiledGenerators(
  cwd: string,
  datamodel: string,
  definitions: Dictionary<GeneratorDefinitionWithPackage>,
): Promise<CompiledGeneratorDefinition[]> {
  const engine = new LiftEngine({ projectDir: cwd })
  const config = await engine.getConfig({ datamodel })
  const dmmf = await getRawDMMF(datamodel)

  const generators = config.generators
    .slice()
    .sort((a, b) => (a.provider === 'photonjs' ? -1 : b.provider === 'photonjs' ? 1 : a.name < b.name ? -1 : 1))
    .map(g => {
      // this is needed so that the "otherGenerators" already include the resolved paths
      const predefinedGenerator = definitions[g.provider]
      if (!predefinedGenerator) {
        return g
      }
      const output =
        g.output ||
        predefinedGenerator.definition.defaultOutput ||
        `node_modules/@generated/${predefinedGenerator.packagePath}`

      return { ...g, output: output ? path.resolve(process.cwd(), output) : null }
    })

  return generators.map((g, index) => {
    const predefinedGenerator = definitions[g.provider]
    const otherGenerators = generators.filter((_, i) => i !== index)
    // Is this a known generator?
    if (predefinedGenerator) {
      return {
        prettyName: predefinedGenerator.definition.prettyName,
        output: g.output,
        generate: () =>
          predefinedGenerator.definition.generate({
            cwd,
            dmmf,
            datamodel,
            dataSources: config.datasources,
            generator: g,
            otherGenerators,
          }),
      } as CompiledGeneratorDefinition
    }

    // If not, try to resolve a binary
    const binPath = path.resolve(cwd, g.provider)
    if (!fs.pathExistsSync(binPath)) {
      const replacement = didYouMeanMap[g.provider]
      if (replacement) {
        const didYouMean = `\nDid you mean ${chalk.greenBright(replacement)}?`
        throw new Error(
          `Unknown generator provider ${g.provider} for generator ${g.name} defined in ${chalk.underline(
            path.join(cwd, 'schema.prisma'),
          )}${didYouMean}`,
        )
      }
      throw new Error(`Could not find generator binary ${chalk.bold(g.provider)}`)
    }

    if (!hasChmodX(binPath)) {
      throw new Error(
        `${chalk.bold(g.provider)} is not executable. Please run ${chalk.greenBright(`chmod +x ${g.provider}`)}`,
      )
    }

    return {
      prettyName: binPath,
      output: g.output,
      generate: async () =>
        (await runGeneratorBinary(binPath, {
          cwd,
          dmmf,
          datamodel,
          dataSources: config.datasources,
          generator: g,
          otherGenerators,
        })).stdout,
    }
  })
}

function hasChmodX(file: string): boolean {
  const s = fs.statSync(file)
  // tslint:disable-next-line
  const newMode = s.mode | 64 | 8 | 1
  return s.mode === newMode
}
