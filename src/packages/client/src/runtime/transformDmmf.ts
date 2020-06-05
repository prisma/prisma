import { DMMF } from './dmmf-types'
import { Dictionary, uniqBy } from './utils/common'

export function transformDmmf(document: DMMF.Document): DMMF.Document {
  const doc = transformOrderInputTypes(transformWhereInputTypes(document))
  return {
    datamodel: doc.datamodel,
    mappings: doc.mappings,
    schema: {
      enums: doc.schema.enums,
      rootMutationType: doc.schema.rootMutationType,
      rootQueryType: doc.schema.rootQueryType,
      outputTypes: filterOutputTypes(doc.schema.outputTypes),
      inputTypes: makeWhereUniqueInputsRequired(
        filterInputTypes(doc.schema.inputTypes),
      ),
    },
  }
}

function filterInputTypes(types: DMMF.InputType[]): DMMF.InputType[] {
  return uniqBy(types, (o) => o.name)
}

function filterOutputTypes(types: DMMF.OutputType[]): DMMF.OutputType[] {
  return uniqBy(types, (o) => o.name)
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
    const inputType: DMMF.InputType = {
      name: type.name,
      atLeastOne: true,
      atMostOne: true,
      isOrderType: true,
      fields: argNames.map((name) => ({
        name,
        inputType: [
          {
            type: 'OrderByArg',
            isList: false,
            isRequired: false,
            isNullable: true,
            kind: 'enum',
          },
        ],
        isRelationFilter: false,
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

function getFieldType(field: DMMF.Field): string {
  if (field.default) {
    if (typeof field.default === 'string') {
      if (field.default === 'uuid') {
        return 'UUID'
      }
    } else if (
      typeof field.default === 'boolean' ||
      typeof field.default === 'number'
    ) {
      return field.type
    } else if (field.default.name === 'uuid') {
      return 'UUID'
    }
  }
  return field.type
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
    let index = type.name.lastIndexOf('WhereInput')
    let modelName = type.name.slice(0, index)
    let model = document.datamodel.models.find((m) => m.name === modelName)!
    if (!model) {
      index = type.name.lastIndexOf('ScalarWhereInput')
      modelName = type.name.slice(0, index)
      model = document.datamodel.models.find((m) => m.name === modelName)!
    }
    if (!model) {
      inputTypes.push(type)
      continue
    }
    const whiteList = ['AND', 'OR', 'NOT']
    whiteList.push(
      ...model.fields
        .filter((f) => f.kind === 'object' && !f.isList)
        .map((f) => f.name),
    )

    const fields = type.fields
      .filter((a) => whiteList.includes(a.name))
      .map((a) => ({ ...a, isRelationFilter: true }))

    const filterTypesList = model.fields
      // filter out scalar lists as Prisma doesn't have filters for them
      // also filter out object non-lists, as we don't need to transform them
      .filter((f) => (f.kind === 'object' ? f.isList : !f.isList))
      .map((f) => {
        if (
          !filterTypes[
            getFilterName(getFieldType(f), f.isRequired || f.kind === 'object')
          ]
        ) {
          filterTypes[
            getFilterName(getFieldType(f), f.isRequired || f.kind === 'object')
          ] = makeFilterType(
            getFieldType(f),
            f.isRequired,
            f.kind !== 'object',
            f.kind === 'enum',
          )
        }

        const typeList: DMMF.SchemaArgInputType[] = []
        if (f.kind !== 'object') {
          typeList.push({
            isList: f.isList,
            isRequired: false,
            isNullable: !f.isRequired,
            kind: f.kind,
            type: getFieldType(f),
          })
        }
        const type = getFilterName(
          getFieldType(f),
          f.isRequired || f.kind === 'object',
        )
        typeList.push({
          type,
          isList: false,
          isRequired: false,
          isNullable: !f.isRequired,
          kind: 'object',
        })

        // for optional scalars you can directly provide null
        if (!f.isRequired && f.kind !== 'object') {
          typeList.push({
            type: 'null',
            isList: false,
            isRequired: false,
            isNullable: !f.isRequired,
            kind: 'scalar',
          })
        }

        const nullEqualsUndefined =
          f.isList && f.kind === 'object' ? true : undefined

        return {
          name: f.name,
          inputType: typeList,
          isRelationFilter: false,
          nullEqualsUndefined,
        }
      })

    // NOTE: list scalar fields don't have where arguments!
    fields.unshift(...filterTypesList)
    const newType: DMMF.InputType = {
      name: type.name,
      fields,
      isWhereType: true,
      atLeastOne: false,
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

function getFilterName(type: string, isRequired: boolean) {
  return `${isRequired ? '' : 'Nullable'}${type}Filter`
}

function getWhereInputName(type: string) {
  return `${type}WhereInput`
}

function makeFilterType(
  type: string,
  isRequired: boolean,
  isScalar: boolean,
  isEnum: boolean,
): DMMF.InputType {
  const name = getFilterName(type, isRequired || !isScalar)
  const isNullable = !isRequired && isScalar
  return {
    name,
    fields: isScalar
      ? getScalarFilterArgs(type, isRequired, isEnum, isNullable)
      : getRelationFilterArgs(type),
    atLeastOne: false,
  }
}

function getRelationFilterArgs(type: string): DMMF.SchemaArg[] {
  return getScalarArgs(
    ['every', 'some', 'none'],
    [getWhereInputName(type)],
    undefined,
    'object',
    false, // relation filters can't be null
  )
}

function getScalarFilterArgs(
  type: string,
  isRequired: boolean,
  isEnum = false,
  isNullable: boolean,
): DMMF.SchemaArg[] {
  if (isEnum) {
    return [
      ...getBaseFilters(type, isRequired, isEnum, isNullable),
      ...getInclusionFilters(type, isEnum, isNullable),
    ]
  }
  switch (type) {
    case 'String':
    case 'ID':
    case 'UUID':
      return [
        ...getBaseFilters(type, isRequired, isEnum, isNullable),
        ...getInclusionFilters(type, isEnum, isNullable),
        ...getAlphanumericFilters(type, isEnum, isNullable),
        ...getStringFilters(type, isEnum, isNullable),
      ]
    case 'Int':
    case 'Float':
    case 'DateTime':
      return [
        ...getBaseFilters(type, isRequired, isEnum, isNullable),
        ...getInclusionFilters(type, isEnum, isNullable),
        ...getAlphanumericFilters(type, isEnum, isNullable),
      ]
    case 'Boolean':
      return [...getBaseFilters(type, isRequired, isEnum, isNullable)]
  }

  return []
}

function getBaseFilters(
  type: string,
  isRequired: boolean,
  isEnum: boolean,
  isNullable: boolean,
): DMMF.SchemaArg[] {
  const filterName = getFilterName(type, isRequired)
  // TODO: reintroduce AND, NOT, OR
  const nullArray = isRequired ? [] : ['null']
  return [
    ...getScalarArgs(
      ['equals'],
      [type, ...nullArray],
      undefined,
      isEnum ? 'enum' : 'scalar',
      isNullable,
    ),
    ...getScalarArgs(
      ['not'],
      [type, ...nullArray, filterName],
      undefined,
      isEnum ? 'enum' : 'scalar',
      isNullable,
    ),
  ]
}

function getStringFilters(
  type: string,
  isEnum: boolean,
  isNullable: boolean,
): DMMF.SchemaArg[] {
  return getScalarArgs(
    ['contains', 'startsWith', 'endsWith'],
    [type],
    undefined,
    isEnum ? 'enum' : 'scalar',
    isNullable,
  )
}

function getAlphanumericFilters(
  type: string,
  isEnum: boolean,
  isNullable: boolean,
): DMMF.SchemaArg[] {
  return getScalarArgs(
    ['lt', 'lte', 'gt', 'gte'],
    [type],
    undefined,
    isEnum ? 'enum' : 'scalar',
    isNullable,
  )
}

function getInclusionFilters(
  type: string,
  isEnum: boolean,
  isNullable: boolean,
): DMMF.SchemaArg[] {
  return getScalarArgs(
    ['in', 'notIn'],
    [type],
    true,
    isEnum ? 'enum' : 'scalar',
    isNullable,
  )
}

function getScalarArgs(
  names: string[],
  type: string[],
  isList = false,
  kind: DMMF.FieldKind = 'scalar',
  isNullable: boolean,
): DMMF.SchemaArg[] {
  return names.map((name) => getScalarArg(name, type, isList, kind, isNullable))
}

function getScalarArg(
  name: string,
  type: string[],
  isList,
  kind: DMMF.FieldKind = 'scalar',
  isNullable: boolean,
): DMMF.SchemaArg {
  return {
    name,
    isRelationFilter: kind === 'object',
    inputType: type.map((t) => ({
      isList,
      isRequired: false,
      isNullable,
      kind,
      type: t,
    })),
  }
}
