export type ExampleApi = {
  meta: {
    version: string
    branch: string
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

export type SetupCommand = {
  command: string
  description: string
}

export type Example = {
  id: string
  name: string
  url: string
  path: string
  language: string
  description: string
  pathToSeedingFile?: string
  issuesLink: string
  nextStepInstructions: ExampleInstruction[]
  setupCommands: SetupCommand[]
  supportedDataSources: string[]
}
