import { IComment, IGQLField, ISDL, isTypeIdentifier } from 'prisma-datamodel'
import { DMMF, DataSource } from '@prisma/generator-helper'
import { Dictionary } from './isdlToDatamodel2'
import { keyBy } from './keyBy'

function getKind(
  field: IGQLField,
  enumMap: Dictionary<DMMF.Enum>,
): DMMF.FieldKind | undefined {
  if (typeof field.type === 'string') {
    if (isTypeIdentifier(field.type)) {
      return 'scalar'
    }
    return undefined
  }

  if (typeof field.type === 'string') {
    if (enumMap[field.type]) {
      return 'enum'
    }
  } else {
    if (enumMap[field.type.name]) {
      return 'enum'
    }
  }

  return 'object'
}

function mapIdType(type: string): string {
  const map = {
    ID: 'String',
    UUID: 'String',
  }
  return map[type] || type
}

function getType(field: IGQLField): string {
  if (typeof field.type === 'string') {
    return field.type
  }

  return field.type.name
}

function convertComments(comments: IComment[]) {
  if (comments.length === 0) {
    return null
  } else {
    return comments.map(c => c.text).join('\n')
  }
}

export function isdlToDmmfDatamodel(
  isdl: ISDL,
  dataSources: DataSource[] = [],
): { dmmf: DMMF.Datamodel; dataSources: DataSource[] } {
  const enums: DMMF.Enum[] = isdl.types
    .filter(t => t.isEnum)
    .map(type => {
      return {
        name: type.name,
        values: type.fields.map(f => f.name),
        documentation: convertComments(type.comments),
      }
    })

  const enumMap = keyBy(enums, e => e.name)

  const models: DMMF.Model[] = isdl.types
    .filter(t => !t.isEnum)
    .map(type => {
      return {
        name: type.name,
        isEmbedded: type.isEmbedded,
        dbName: type.databaseName,
        documentation: convertComments(type.comments),
        idFields: [], // TODO: Get this from introspection.
        // Probably won't happen as we move to Rust
        fields: type.fields
          .filter(f => f.type !== 'Json' && getKind(f, enumMap))
          .map(field => {
            const kind = getKind(field, enumMap)
            let defaultValue
            if (field.type === 'ID') {
              defaultValue = {
                name: 'cuid',
                returnType: 'String',
                args: [],
              }
            }

            if (field.type === 'UUID') {
              defaultValue = {
                name: 'uuid',
                returnType: 'String',
                args: [],
              }
            }

            if (field.isCreatedAt) {
              defaultValue = {
                name: 'now',
                returnType: 'DateTime',
                args: [],
              }
            }

            return {
              name: field.name,
              kind,
              dbName: field.databaseName,
              isGenerated: false,
              isId: field.isId,
              isList: field.isList,
              isRequired: field.isRequired,
              isUnique: field.isUnique,
              relationName:
                field.relationName === ''
                  ? undefined
                  : field.relationName || undefined,
              type: mapIdType(getType(field)),
              default: defaultValue,
              isUpdatedAt: field.isUpdatedAt,
              documentation: convertComments(field.comments),
            } as DMMF.Field
          }),
      }
    })

  const result = { dmmf: { models, enums }, dataSources }

  return result
}
