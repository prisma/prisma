import { CompiledGeneratorDefinition, Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import path from 'path'
import { LiftEngine } from '../../LiftEngine'
import chalk from 'chalk'
import fs from 'fs-extra'
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

  const generators = config.generators
    .slice()
    .sort((a, b) => (a.provider === 'photonjs' ? -1 : b.provider === 'photonjs' ? 1 : a.name < b.name ? -1 : 1))

  return config.generators.map((g, index) => {
    const otherGenerators = generators.filter((g, i) => i !== index)
    if (g.provider.startsWith('.') || g.provider.startsWith('/')) {
      const binPath = path.resolve(cwd, g.provider)
      if (!fs.pathExistsSync(binPath)) {
        throw new Error(`Could not find generator binary ${chalk.bold(g.provider)}`)
      }
      if (!hasChmodX(binPath)) {
        throw new Error(
          `${chalk.bold(g.provider)} is not executable. Please run ${chalk.greenBright(`chmod +x ${g.provider}`)}`,
        )
      }
      return {
        prettyName: binPath,
        generate: async () =>
          (await runGeneratorBinary(binPath, {
            cwd,
            generator: {
              ...g,
              output: g.output ? path.resolve(process.cwd(), g.output) : undefined,
            },
            otherGenerators,
          })).stdout,
      }
    }

    const predefinedGenerator = definitions[g.provider]
    if (!predefinedGenerator) {
      const replacement = didYouMeanMap[g.provider]
      const didYouMean = replacement ? `\nDid you mean ${chalk.greenBright(replacement)}?` : ''
      throw new Error(
        `Unknown generator provider ${g.provider} for generator ${g.name} defined in ${chalk.underline(
          path.join(cwd, 'project.prisma'),
        )}${didYouMean}`,
      )
    }
    const output =
      g.output ||
      predefinedGenerator.definition.defaultOutput ||
      `node_modules/@generated/${predefinedGenerator.packagePath}`

    return {
      prettyName: predefinedGenerator.definition.prettyName,
      generate: () =>
        predefinedGenerator.definition.generate({
          cwd,
          generator: { ...g, output },
          otherGenerators,
        }),
    } as CompiledGeneratorDefinition
  })
}

function hasChmodX(file: string): boolean {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  return s.mode === newMode
}
