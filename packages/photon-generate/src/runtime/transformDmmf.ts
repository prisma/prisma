import { DMMF } from './dmmf-types'
import { uniqBy, Dictionary, stringifyInputType } from './utils/common'

function transformDmmf(document: DMMF.Document): DMMF.Document {
  filterInputTypes(document)
  filterOutputTypes(document)
  transformInputTypes(document)
  return document
}

function filterInputTypes(document: DMMF.Document) {
  document.schema.inputTypes = uniqBy(document.schema.inputTypes, o => o.name).filter(
    o => !o.name.includes('Subscription') && o.name !== 'MutationType',
  )
}

function filterOutputTypes(document: DMMF.Document) {
  document.schema.outputTypes = uniqBy(document.schema.outputTypes, o => o.name).filter(o => {
    return !o.name.endsWith('PreviousValues') && !o.name.includes('Subscription')
  })
}

function transformInputTypes(document: DMMF.Document) {
  const types = document.schema.inputTypes
  const inputTypes: DMMF.InputType[] = []
  const filterTypes: Dictionary<DMMF.InputType> = {}
  for (const type of types) {
    if (!type.name.endsWith('WhereInput')) {
      inputTypes.push(type)
      continue
    }

    // lastIndexOf necessary if a type is called "WhereInput"
    const index = type.name.lastIndexOf('WhereInput')
    const modelName = type.name.slice(0, index)
    const model = document.datamodel.models.find(m => m.name === modelName)!
    const args = type.args.filter(a => ['AND', 'OR', 'NOT'].includes(a.name))
    // NOTE: list scalar fields don't have where arguments!
    args.push(
      ...model.fields
        .filter(f => !f.isList)
        .map(f => {
          if (!filterTypes[getFilterName(f.type)]) {
            filterTypes[getFilterName(f.type)] = makeFilterType(f.type)
          }
          return {
            name: f.name,
            type: [`${f.type}${f.isList ? 'List' : ''}Filter`],
            isScalar: false,
            isRequired: false,
            isEnum: false,
            isList: false,
          }
        }),
    )
    const newType = {
      name: type.name,
      args,
    }
    console.log(modelName, !!model)
    console.log(stringifyInputType(newType) + '\n')
    inputTypes.push(newType)
  }
  const scalarFilters = Object.values(filterTypes)
  return inputTypes.push(...scalarFilters)
}

function getFilterName(type: string) {
  return `${type}Filter`
}

function makeFilterType(type: string): DMMF.InputType {
  return {
    name: getFilterName(type),
    args: getFilterArgs(type),
  }
}

function getFilterArgs(type: string): DMMF.SchemaArg[] {
  const args: DMMF.SchemaArg[] = getScalarArgs(['equals', 'not'], type)
  switch (type) {
    case 'String':
    case 'ID':
    case 'UUID':
      args.push(...getScalarArgs(['contains', 'startsWith', 'endsWith'], type))
  }

  return args
}

// CONTINUE HERE: Add support for Union Input Types in DMMF, then think about places where we have them:
// - not: {} or not: 5
// - equals: {} or equals: 5
// - id: {} or id: 5

function getBaseFilters(type: string): DMMF.SchemaArg[] {
  return [...getScalarArgs(['equals', 'not'], type), ...getScalarArgs(['AND', 'NOT', 'OR'], getFilterName(type))]
}

function getStringFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['contains', 'startsWith', 'endsWith'], type)
}

function getAlphanumericFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['lt', 'lte', 'gt', 'gte'], type)
}

function getInclusionFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['in', 'notIn'], type)
}

function getScalarArgs(names: string[], type: string): DMMF.SchemaArg[] {
  return names.map(name => getScalarArg(name, type))
}

// {
//   where: {
//     id: {
//       not: {
//         equals: 5
//       }
//     }
//   }
// }

function getScalarArg(name: string, type: string, isList = false): DMMF.SchemaArg {
  return {
    name,
    isEnum: false,
    isList,
    isRequired: false,
    isScalar: true,
    type: [type],
  }
}
