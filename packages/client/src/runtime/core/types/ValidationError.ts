export type ValidationError =
  | {
      kind: 'includeAndSelect'
      selectionPath: string[]
    }
  | {
      kind: 'includeOnScalar'
      selectionPath: string[]
      meta: {
        outputType: OutputTypeDescription
      }
    }

// TODO: engine-side validation errors

export type OutputTypeDescription = {
  name: string
  fields?: OutputTypeDescriptionField[]
}

type OutputTypeDescriptionField = {
  name: string
  typeName: string
  isRelation: boolean
}
