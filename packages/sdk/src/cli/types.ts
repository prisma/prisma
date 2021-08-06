/**
 * Command interface
 */
export interface Command {
  parse(argv: string[]): Promise<string | Error>
}

/**
 * Commands
 */
export type Commands = { [command: string]: Command }

export type Dictionary<T> = {
  [key: string]: T
}

export type GeneratorConfig = {
  output: string | null
  name: string
  provider: string
  config: Dictionary<string>
  binaryTargets: string[]
  pinnedBinaryTargets?: string | null
}

export type GeneratorOptions = {
  generator: GeneratorConfig
  otherGenerators: GeneratorConfig[]
  cwd: string
  dmmf: any
  datasources: any
  datamodel: string
}

export type GeneratorFunction = (options: GeneratorOptions) => Promise<string>

export type GeneratorDefinition = {
  prettyName?: string // used to print in prisma dev command
  generate: GeneratorFunction
  defaultOutput: string
}

export type GeneratorDefinitionWithPackage = {
  definition: GeneratorDefinition
  packagePath: string
}

export type CompiledGeneratorDefinition = {
  prettyName?: string // used to print in prisma dev command
  output?: string | null
  generate: () => Promise<string>
}
