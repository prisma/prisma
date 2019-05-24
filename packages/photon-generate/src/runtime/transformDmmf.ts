import { DMMF } from './dmmf-types'
import { Dictionary, stringifyInputType, uniqBy } from './utils/common'

export function transformDmmf(document: DMMF.Document): DMMF.Document {
  const doc = transformOrderInputTypes(transformWhereInputTypes(document))
  return {
    datamodel: doc.datamodel,
    mappings: doc.mappings,
    schema: {
      enums: doc.schema.enums,
      queries: doc.schema.queries,
      mutations: doc.schema.mutations,
      outputTypes: filterOutputTypes(doc.schema.outputTypes),
      inputTypes: filterInputTypes(doc.schema.inputTypes),
    },
  }
}

function filterInputTypes(types: DMMF.InputType[]): DMMF.InputType[] {
  return uniqBy(types, o => o.name).filter(o => !o.name.includes('Subscription') && o.name !== 'MutationType')
}

function filterOutputTypes(types: DMMF.OutputType[]): DMMF.OutputType[] {
  return uniqBy(types, o => o.name).filter(o => {
    return !o.name.endsWith('PreviousValues') && !o.name.includes('Subscription')
  })
}

function transformOrderInputTypes(document: DMMF.Document): DMMF.Document {
  const inputTypes: DMMF.InputType[] = document.schema.inputTypes
  const enums: DMMF.Enum[] = [
    {
      name: 'OrderByArg',
      values: ['asc', 'desc'],
    },
  ]
  for (const type of document.schema.enums) {
    if (!type.name.endsWith('OrderByInput')) {
      enums.push(type)
      continue
    }
    const argNames = type.values.reduce<string[]>((acc, curr) => {
      if (curr.endsWith('ASC')) {
        const index = curr.lastIndexOf('_ASC')
        acc.push(curr.slice(0, index))
      }
      return acc
    }, [])
    const inputType = {
      name: type.name,
      atLeastOne: true,
      atMostOne: true,
      isOrderType: true,
      args: argNames.map(name => ({
        name,
        type: ['OrderByArg'],
        isEnum: false,
        isList: false,
        isRelationFilter: false,
        isRequired: false,
        isScalar: true,
      })),
    }
    inputTypes.push(inputType)
  }

  return {
    datamodel: document.datamodel,
    mappings: document.mappings,
    schema: {
      ...document.schema,
      inputTypes,
      enums,
    },
  }
}

function transformWhereInputTypes(document: DMMF.Document): DMMF.Document {
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
      inputTypes.push(type)
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
    const args = type.args.filter(a => whiteList.includes(a.name)).map(a => ({ ...a, isRelationFilter: true }))
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
            isRelationFilter: false,
          }
        }),
    )
    const newType: DMMF.InputType = {
      name: type.name,
      args,
      isWhereType: true,
    }
    inputTypes.push(newType)
  }
  const scalarFilters = Object.values(filterTypes)
  inputTypes.push(...scalarFilters)

  return {
    datamodel: document.datamodel,
    mappings: document.mappings,
    schema: {
      ...document.schema,
      inputTypes,
    },
  }
}

function getFilterName(type: string) {
  return `${type}Filter`
}

function makeFilterType(type: string): DMMF.InputType {
  return {
    name: getFilterName(type),
    args: getFilterArgs(type),
    atLeastOne: true,
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
    ...getScalarArgs(['equals'], [type]),
    ...getScalarArgs(['not'], [type, filterName]) /*, ...getScalarArgs(['AND', 'NOT', 'OR'], [filterName])*/,
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
