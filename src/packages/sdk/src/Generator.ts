import {
  GeneratorOptions,
  GeneratorProcess,
  GeneratorManifest,
  BinaryPaths,
} from '@prisma/generator-helper'
import Debug from 'debug'

export class Generator {
  private generatorProcess: GeneratorProcess
  private debug: Debug.Debugger
  public manifest: GeneratorManifest | null = null
  public options?: GeneratorOptions
  constructor(private executablePath: string) {
    this.generatorProcess = new GeneratorProcess(this.executablePath)
    this.debug = Debug(`Generator:${executablePath}`)
  }
  async init(): Promise<void> {
    await this.generatorProcess.init()
    this.debug(`Sending "getManifest" rpc to generator`)
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
    this.debug(`Sending "generate" rpc to generator`)
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
}
