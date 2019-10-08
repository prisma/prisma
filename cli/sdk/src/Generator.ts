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
  constructor(private executablePath: string) {
    this.generatorProcess = new GeneratorProcess(this.executablePath)
  }
  async init() {
    await this.generatorProcess.init()
    this.manifest = await this.generatorProcess.getManifest()
  }
  stop() {
    this.generatorProcess.stop()
  }
  generate(): Promise<void> {
    if (!this.options) {
      throw new Error(
        `Please first run .setOptions() on the Generator to initialize the options`,
      )
    }
    return this.generatorProcess.generate(this.options!)
  }
  setOptions(options: GeneratorOptions) {
    this.options = options
  }
  setBinaryPaths(binaryPaths: BinaryPaths) {
    if (!this.options) {
      throw new Error(
        `Please first run .setOptions() on the Generator to initialize the options`,
      )
    }
    this.options.binaryPaths = binaryPaths
  }
}
