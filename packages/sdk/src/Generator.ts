import type { GeneratorOptions, GeneratorManifest, BinaryPaths, GeneratorConfig } from '@prisma/generator-helper'
import { GeneratorProcess } from '@prisma/generator-helper'

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
}
