import { CompiledGeneratorDefinition, Dictionary } from '@prisma/cli'
import path from 'path'
import { GeneratorDefinitionWithPackage } from '../types'
import { LiftEngine } from '../LiftEngine'
import { generateInThread } from '../generateInThread'

export async function getCompiledGenerators(
  cwd: string,
  datamodel: string,
  definitions: Dictionary<GeneratorDefinitionWithPackage>,
): Promise<CompiledGeneratorDefinition[]> {
  const engine = new LiftEngine({ projectDir: cwd })
  const config = await engine.getConfig({ datamodel })

  const generators = config.generators.map(g => ({
    ...g,
    output: g.output && !g.output.startsWith('/') ? path.join(cwd, g.output) : null,
  }))

  generators.sort((a, b) => (a.provider === 'photogen' ? 1 : b.provider === 'photogen' ? -1 : a.name < b.name ? -1 : 1))

  return generators.map((definition, index) => {
    const generator = definitions[definition.provider]
    if (!generator) {
      throw new Error(
        `Unknown generator provider ${definition.provider} for generator ${definition.name} defined in ${path.join(
          cwd,
          'datamodel.prisma',
        )}`,
      )
    }

    const otherGenerators = generators.filter((g, i) => i !== index)

    return {
      prettyName: generator.definition.prettyName,
      generate: () =>
        generateInThread({
          packagePath: generator.packagePath,
          config: {
            cwd,
            generator: definition,
            otherGenerators,
          },
        }),
    } as CompiledGeneratorDefinition
  })
}
