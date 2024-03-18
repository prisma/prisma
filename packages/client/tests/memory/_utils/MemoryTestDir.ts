import path from 'path'

export class MemoryTestDir {
  readonly basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  get testName(): string {
    return path.basename(this.basePath)
  }

  get schemaFilePath(): string {
    return path.join(this.basePath, 'prisma', 'schema.prisma')
  }

  get generatedDir(): string {
    return path.join(this.basePath, '.generated')
  }

  get reportPath(): string {
    return path.join(this.generatedDir, 'report.html')
  }

  get resultsPath(): string {
    return path.join(this.generatedDir, 'result')
  }

  get sourceTestPath(): string {
    return path.join(this.basePath, 'test.ts')
  }

  get compiledTestPath(): string {
    return path.join(this.generatedDir, 'test.js')
  }
}
