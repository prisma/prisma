export type ExampleApi = {
  meta: {
    version: string
  }
  examples: { [language: string]: ExampleLanguageDefinition }
}

export type ExampleLanguageDefinition = {
  [exampleName: string]: Example
}

export type ExampleInstruction = {
  description: string
  commands: string[]
}

export type Example = {
  name: string
  description: string
  pathToSeedingFile?: string
  issuesLink: string
  nextStepInstructions: ExampleInstruction[]
  setupCommands: string[]
  supportedDataSources: string[]
}
