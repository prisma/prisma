export type ExtensionConfig = {
  types: ExtensionType[]
}

export type ExtensionType = {
  prismaName: string
  dbName: string
  dbNamespace?: string
  dbTypeModifiers?: string[]
  numberOfDbTypeModifiers: number
}
