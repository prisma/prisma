import {
  GeneratorOptions,
  GeneratorProcess,
  GeneratorManifest,
  BinaryPaths,
} from '@prisma/generator-helper'

export class Generator {
  private generatorProcess: GeneratorProcess
  public manifest: GeneratorManifest | null = null
  constructor(
    private executablePath: string,
    public options: GeneratorOptions,
  ) {
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
    return this.generatorProcess.generate(this.options)
  }
  setBinaryPaths(binaryPaths: BinaryPaths) {
    this.options.binaryPaths = binaryPaths
  }
}
