import {
  GeneratorOptions,
  GeneratorProcess,
  GeneratorManifest,
  BinaryPaths,
} from '@prisma/generator-helper'

export class Generator {
  private generatorProcess: GeneratorProcess
  public manifest: GeneratorManifest | null = null
  public options?: GeneratorOptions
  constructor(executablePath: string, isNode?: boolean) {
    this.generatorProcess = new GeneratorProcess(executablePath, isNode)
  }
  async init(): Promise<void> {
    await this.generatorProcess.init()
    this.manifest = await this.generatorProcess.getManifest()
  }
  stop(): void {
    this.generatorProcess.stop()
  }
  generate(): Promise<any> {
    if (!this.options) {
      throw new Error(
        `Please first run .setOptions() on the Generator to initialize the options`,
      )
    }
    return this.generatorProcess.generate(this.options)
  }
  setOptions(options: GeneratorOptions): void {
    this.options = options
  }
  setBinaryPaths(binaryPaths: BinaryPaths): void {
    if (!this.options) {
      throw new Error(
        `Please first run .setOptions() on the Generator to initialize the options`,
      )
    }
    this.options.binaryPaths = binaryPaths
  }
  getUseMessage(): Promise<string> {
    if (!this.options) {
      throw new Error(
          `Please first run .setOptions() on the Generator to initialize the options`,
      )
    }
    return this.generatorProcess.getUseMessage(this.options)
  }
}
