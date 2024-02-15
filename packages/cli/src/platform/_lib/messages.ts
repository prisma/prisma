import { formatTable } from '@prisma/internals'
import { green } from 'kleur/colors'

export const messages = {
  resourceCreated: (resource: { __typename: string; id: string; displayName: string }) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} created.`),
  resourceDeleted: (resource: { __typename: string; id: string; displayName: string }) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} deleted.`),
  info: (message: string) => message,
  table: <$Data extends object>(data: $Data, properties: (keyof $Data)[]) => {
    return formatTable(
      properties.map((propertyName) => {
        const value = (data as Record<keyof $Data, unknown>)[propertyName]
        return [String(propertyName), String(value)]
      }),
    )
  },
  listTables: <$Data extends object>(records: $Data[], properties: (keyof $Data)[]) =>
    records.map((record) => messages.table(record, properties)).join('\n\n\n'),
  sections: (sections: string[]) => sections.join('\n\n'),
}

export const successMessage = (message: string) => `${green('Success!')} ${message}`
