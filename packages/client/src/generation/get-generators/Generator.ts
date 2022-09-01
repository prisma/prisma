import type { BinaryPaths, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator-helper'
import { GeneratorProcess } from '@prisma/generator-helper'
import { parseEnvValue } from '@prisma/internals'

export class Generator {
  private generatorProcess: GeneratorProcess
  public manifest: GeneratorManifest | null = null
  public config: GeneratorConfig
  public options?: GeneratorOptions
  constructor(executablePath: string, config: GeneratorConfig, isNode?: boolean) {
    this.config = config
    this.generatorProcess = new GeneratorProcess(executablePath, isNode)
  }
  async init(): Promise<void> {
    await this.generatorProcess.init()
    this.manifest = await this.generatorProcess.getManifest(this.config)
  }
  stop(): void {
    this.generatorProcess.stop()
  }
  generate(): Promise<any> {
    if (!this.options) {
      throw new Error(`Please first run .setOptions() on the Generator to initialize the options`)
    }
    return this.generatorProcess.generate(this.options)
  }
  setOptions(options: GeneratorOptions): void {
    this.options = options
  }
  setBinaryPaths(binaryPaths: BinaryPaths): void {
    if (!this.options) {
      throw new Error(`Please first run .setOptions() on the Generator to initialize the options`)
    }
    this.options.binaryPaths = binaryPaths
  }

  /**
   * Returns the pretty name of the generator specified in the manifest (e.g.,
   * "Prisma Client"), or, if the former is not defined, the generator's
   * provider name (e.g., "prisma-client-js") as a fallback.
   */
  getPrettyName(): string {
    return this.manifest?.prettyName ?? this.getProvider()
  }

  /**
   * Returns the provider name, parsed and resolved from environment variable
   * if necessary.
   */
  getProvider(): string {
    return parseEnvValue(this.config.provider)
  }
}
