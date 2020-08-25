import { DMMF } from './dmmf-types'
import { uniqBy } from './utils/common'
import klona from 'klona'

export function transformDmmf(document: DMMF.Document): DMMF.Document {
  const doc = transformInputTypes(document)
  return {
    datamodel: doc.datamodel,
    mappings: doc.mappings,
    schema: {
      enums: doc.schema.enums,
      rootMutationType: doc.schema.rootMutationType,
      rootQueryType: doc.schema.rootQueryType,
      outputTypes: filterOutputTypes(doc.schema.outputTypes),
      inputTypes: markOrderInputType(
        makeWhereUniqueInputsRequired(filterInputTypes(doc.schema.inputTypes)),
      ),
    },
  }
}

/**
 * Set `isOrderType`
 * @param inputTypes 
 */
function markOrderInputType(inputTypes: DMMF.InputType[]): DMMF.InputType[] {
  return inputTypes.map((t) => {
    if (t.name.endsWith('OrderByInput')) {
      t.isOrderType = true
    }
    return t
  })
}

/**
 * Filter duplicate input types
 */
function filterInputTypes(types: DMMF.InputType[]): DMMF.InputType[] {
  return uniqBy(types, (o) => o.name)
}

/**
 * Filter duplicate output types
 */
function filterOutputTypes(types: DMMF.OutputType[]): DMMF.OutputType[] {
  return uniqBy(types, (o) => o.name)
}

/**
 * Add `atLeastOne` to unique where input types
 * @param inputTypes 
 */
function makeWhereUniqueInputsRequired(
  inputTypes: DMMF.InputType[],
): DMMF.InputType[] {
  return inputTypes.map((inputType) => {
    if (inputType.name.endsWith('WhereUniqueInput')) {
      inputType.atLeastOne = true
    }
    return inputType
  })
}

function transformInputTypes(document: DMMF.Document): DMMF.Document {
  const inputTypeMap: Record<string, DMMF.InputType> = Object.create(null)

  for (const inputType of document.schema.inputTypes) {
    inputTypeMap[inputType.name] = inputType
  }

  const inputTypeFieldLookupMap: Record<string, Record<string, DMMF.SchemaArg>> = Object.create(null)

  document.schema.inputTypes = document.schema.inputTypes.map(inputType => {
    // add `notIn`
    if (inputType.name.endsWith('Filter') && !inputType.name.endsWith('RelationFilter')) {
      const inFieldIndex = inputType.fields.findIndex(f => f.name === 'in')

      if (inFieldIndex > -1) {
        const inField = inputType.fields[inFieldIndex]
        const notInField = klona(inField)
        notInField.name = 'notIn'
        inputType.fields.splice(inFieldIndex + 1, 0, notInField)
      }
    }

    // 1. set `isWhereType` for normal where types
    // 2. add multiple different union types
    if (inputType.name.endsWith('WhereInput')) {
      inputType.isWhereType = true

      inputType.fields = inputType.fields.map(f => {
        const inputTypeType = f.inputType[0]
        const inputTypeName = inputTypeType.type.toString()
        if (inputTypeName.endsWith('Filter')) {

          // TODO: improve name selection here
          if (inputTypeName.endsWith('RelationFilter')) {
            const nestedInputType = inputTypeMap[inputTypeName]
            const isField = nestedInputType.fields.find(f => f.name === 'is')
            // lift "is" fields of to one relation filter up - basically skip them
            if (isField) {
              f.inputType[0] = isField.inputType[0]
            }
          }

          const filterType = inputTypeMap[inputTypeName]

          if (!filterType) {
            throw new Error(`Could not find filterType ${filterType}`)
          }
          // TODO: optimize
          let equalsField = inputTypeFieldLookupMap[inputTypeName]?.equals
          if (!equalsField) {
            equalsField = filterType.fields.find(field => field.name === 'equals')!
            inputTypeFieldLookupMap[inputTypeName] = {
              equals: equalsField
            }
          }

          // there might not be an equals field, if it's a relation filter
          if (equalsField) {
            // Don't add ` | Json` for json types, as we need strict types there
            // Otherwise there is an ambiguity between { equals: {} } and { equals: { equals: ... } }
            if (equalsField.inputType[0].type !== 'Json') {
              f.inputType.unshift(equalsField.inputType[0])
            }

            if (equalsField.inputType[0].isNullable) {
              f.inputType.push({
                isList: false,
                isNullable: true,
                isRequired: false,
                kind: 'scalar',
                type: 'null'
              })
            }
            if (!inputTypeFieldLookupMap[inputTypeName].not) {
              const notField = filterType.fields.find(field => field.name === 'not')
              if (notField && notField.inputType.length === 1) {
                notField.inputType.unshift(equalsField.inputType[0])
              }
              inputTypeFieldLookupMap[inputTypeName].not = notField!
            }
          }
        }
        return f
      })
    }

    // if (inputType.name.endsWith('RelationFilter')) {
    //   const isField = inputType.fields.find(f => f.name === 'is')
    //   const isNotField = inputType.fields.find(f => f.name === 'isNot')
    //   // if both fields are here, we're operating on the correct patient ;)
    //   if (isField && isNotField) {
    //     inputType
    //   }
    // }

    // set `atLeastOne` for unique where types
    if (inputType.name.endsWith('WhereUniqueInput')) {
      inputType.atLeastOne = true
    }

    return inputType
  })
  return document
}
