import * as sqlTemplateTag from 'sql-template-tag'

export function isSql(value: any): value is sqlTemplateTag.Sql {
  return value.constructor.name === 'Sql'
}
