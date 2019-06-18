import { CompiledGeneratorDefinition, Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import path from 'path'
import { LiftEngine } from '../LiftEngine'
import chalk from 'chalk'
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

  const generators = config.generators.map(g => {
    const generator = definitions[g.provider]
    if (!generator) {
      const replacement = didYouMeanMap[g.provider]
      const didYouMean = replacement ? `\nDid you mean ${chalk.greenBright(replacement)}?` : ''
      throw new Error(
        `Unknown generator provider ${g.provider} for generator ${g.name} defined in ${chalk.underline(
          path.join(cwd, 'project.prisma'),
        )}${didYouMean}`,
      )
    }
    const output = g.output || generator.definition.defaultOutput || `node_modules/@generated/${generator.packagePath}`
    return {
      ...g,
      output: path.resolve(process.cwd(), output), // TODO: More sophisticated logic to resolve project dir vs prisma dir...
    }
  })

  generators.sort((a, b) => (a.provider === 'photonjs' ? -1 : b.provider === 'photonjs' ? 1 : a.name < b.name ? -1 : 1))

  return generators.map((definition, index) => {
    const generator = definitions[definition.provider]
    const otherGenerators = generators.filter((g, i) => i !== index)

    return {
      prettyName: generator.definition.prettyName,
      generate: () =>
        generator.definition.generate({
          cwd,
          generator: definition,
          otherGenerators,
        }),
    } as CompiledGeneratorDefinition
  })
}
