import { DMMF } from './dmmf-types'
import { uniqBy, Dictionary, stringifyInputType } from './utils/common'

export function transformDmmf(document: DMMF.Document): DMMF.Document {
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
    if (!model) {
      console.log(`${modelName} is not a model`)
      continue
    }
    const whiteList = ['AND', 'OR', 'NOT']
    for (const field of model.fields.filter(f => f.kind === 'relation')) {
      const { name } = field
      if (field.isList) {
        whiteList.push(...[`${name}_every`, `${name}_some`, `${name}_none`])
      } else {
        whiteList.push(name)
      }
    }
    const args = type.args.filter(a => whiteList.includes(a.name))
    // NOTE: list scalar fields don't have where arguments!
    args.unshift(
      ...model.fields
        .filter(f => !f.isList && f.kind === 'scalar')
        .map(f => {
          if (!filterTypes[getFilterName(f.type)]) {
            filterTypes[getFilterName(f.type)] = makeFilterType(f.type)
          }
          return {
            name: f.name,
            type: [f.type, `${f.type}${f.isList ? 'List' : ''}Filter`, ...(f.isRequired ? [] : ['null'])],
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
  scalarFilters.forEach(f => {
    console.log(stringifyInputType(f))
  })
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

function getFilterArgs(type: string, isEnum = false): DMMF.SchemaArg[] {
  if (isEnum) {
    return [...getBaseFilters(type), ...getInclusionFilters(type)]
  }
  switch (type) {
    case 'String':
    case 'ID':
    case 'UUID':
      return [
        ...getBaseFilters(type),
        ...getInclusionFilters(type),
        ...getAlphanumericFilters(type),
        ...getStringFilters(type),
      ]
    case 'Int':
    case 'Float':
    case 'DateTime':
      return [...getBaseFilters(type), ...getInclusionFilters(type), ...getAlphanumericFilters(type)]
    case 'Boolean':
      return [...getBaseFilters(type)]
  }

  return []
}

function getBaseFilters(type: string): DMMF.SchemaArg[] {
  const filterName = getFilterName(type)
  // TODO: reintroduce AND, NOT, OR
  return [
    ...getScalarArgs(['equals', 'not'], [type, filterName]) /*, ...getScalarArgs(['AND', 'NOT', 'OR'], [filterName])*/,
  ]
}

function getStringFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['contains', 'startsWith', 'endsWith'], [type])
}

function getAlphanumericFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['lt', 'lte', 'gt', 'gte'], [type])
}

function getInclusionFilters(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(['in', 'notIn'], [type])
}

function getScalarArgs(names: string[], type: string[]): DMMF.SchemaArg[] {
  return names.map(name => getScalarArg(name, type))
}

function getScalarArg(name: string, type: string[], isList = false): DMMF.SchemaArg {
  return {
    name,
    isEnum: false,
    isList,
    isRequired: false,
    isScalar: true,
    type,
  }
}
