export interface Target {
  getBinaryTargets(): string[]
  afterPnpmInstall(workbenchPath: string): Promise<void>
  afterClientGeneration(workbenchPath: string): Promise<void>
  measure(workbenchPath: string): Promise<Record<string, number>>
}
