import { formatTable, mapObjectValues } from '@prisma/internals'
import { bold, dim, green, white } from 'kleur/colors'

import { id } from './prelude'

interface Resource {
  __typename: string
  id: string
  displayName: string
  createdAt?: string
}

type Renderer<T> = (value: T) => string | null

type ObjectValueRenderersInput<$Object extends object> = {
  [Key in keyof $Object]?: Renderer<$Object[Key]> | true
}

interface Table {
  <$Object extends object>(
    object: $Object,
    renderers: {
      key?: Renderer<string>
      values?: ObjectValueRenderersInput<$Object>
    },
  ): string
}
const table: Table = (data, propertiesOrRenderers) => {
  const renderers = {
    key: propertiesOrRenderers.key ?? dim,
    // eslint-disable-next-line
    values: mapObjectValues(propertiesOrRenderers.values ?? ({} as any), (_: true | Renderer<any>) =>
      _ === true ? id : _,
    ),
  }
  return formatTable(
    Object.entries(renderers.values)
      .map(([propertyName, renderer]) => {
        const valueRendered = renderer(data[propertyName]) as null | string // todo ask for TS help here
        if (valueRendered === null) return null
        return [renderers.key(String(propertyName)), valueRendered]
      })
      .filter(Boolean) as string[][],
  )
}

export const messages = {
  resourceCreated: (resource: Resource) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} created.`),
  resourceDeleted: (resource: Resource) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} deleted.`),
  resource: <$Resource extends Resource>(resource: $Resource, renderers?: ObjectValueRenderersInput<$Resource>) => {
    return messages.table(resource, {
      // @ts-expect-error todo ask for TS help here
      values: {
        displayName: (_) => white(bold(_)),
        id: true,
        createdAt: (_) => (_ ? Intl.DateTimeFormat().format(new Date(_)) : null),
        ...renderers,
      },
    })
  },
  resourceList: (records: Resource[]) => {
    if (records.length === 0) return messages.info('No records found.')
    return records.map((record) => messages.resource(record)).join('\n\n\n')
  },
  info: (message: string) => message,
  sections: (sections: string[]) => sections.join('\n\n'),
  table,
}

export const successMessage = (message: string) => `${green('Success!')} ${message}`
