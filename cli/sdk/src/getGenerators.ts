import fs from 'fs'
import { getConfig, getDMMF } from './engineCommands'
import { Dictionary } from './keyBy'
import { EnvValue } from './isdlToDatamodel2'

/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 * @param schemaPath Path to schema.prisma
 * @param generatorAliases Aliases like `photonjs` -> `node_modules/photonjs/gen.js`
 */
export async function getGenerators(
  schemaPath: string,
  generatorAliases?: { [alias: string]: string },
): Promise<Generator[]> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`${schemaPath} does not exist`)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  const dmmf = await getDMMF(schema)
  const config = await getConfig(schema)
  return await Promise.all(
    config.generators.map(async generator => {
      let generatorPath = generator.provider
      if (generatorAliases && generatorAliases[generator.provider]) {
        generatorPath = generatorAliases[generator.provider]
        if (!fs.existsSync(generatorPath)) {
          throw new Error(
            `Could not find generator executable ${
              generatorAliases[generator.provider]
            } for generator ${generator.provider}`,
          )
        }
      }

      const options = {} // CONTINUE: Make sure that we get the options as defined in the spec
      // The types for the options should live in the helper package
      // So probably next implement the helper package

      const generatorInstance = new Generator(
        generator.name,
        generator.output,
        generator.provider,
        generator.config,
        generatorPath,
        options,
      )

      await generatorInstance.init()

      return generatorInstance
    }),
  )
}

class Generator {
  constructor(
    public name: string,
    public output: string | null,
    public provider: string,
    public config: Dictionary<string>,
    private generatorPath: string,
    private options: GeneratorOptions,
  ) {}
  async init() {
    // CONTINUE: Spawn the process
  }
  stop() {}
  generate(): Promise<void> {
    return Promise.resolve()
  }
}

interface GeneratorOptions {}
