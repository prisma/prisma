import { GeneratorConfig, GeneratorManifest, GeneratorOptions } from './configuration'

export type Generator = {
  readonly name: string
  getManifest(config: GeneratorConfig): Promise<GeneratorManifest>
  generate(options: GeneratorOptions): Promise<void>
}
