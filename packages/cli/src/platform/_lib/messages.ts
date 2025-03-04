import { formatTable, mapObjectValues } from '@prisma/internals'
import { bold, dim, green, white } from 'kleur/colors'

import { id, type Mapped, type NoInfer } from './prelude'

interface Resource {
  __typename: string
  id: string
  displayName: string
  createdAt?: string
}

type Renderer<T> = (value: T) => string | null

type ObjectValueRenderersInput<$Object> = {
  [Key in keyof $Object]?: Renderer<$Object[Key]> | true
}

const table = <$Object extends object>(
  object: Mapped<$Object>,
  renderersInput: {
    key?: Renderer<string>
    values?: ObjectValueRenderersInput<NoInfer<$Object>>
  },
) => {
  const renderers = {
    key: renderersInput.key ?? dim,
    // eslint-disable-next-line
    values: mapObjectValues(renderersInput.values ?? ({} as any), (_: true | Renderer<any>) => (_ === true ? id : _)),
  }
  return formatTable(
    Object.entries(renderers.values)
      .map(([propertyName, renderer]) => {
        const valueRendered = renderer(object[propertyName]) as null | string // todo ask for TS help here
        if (valueRendered === null) return null
        return [renderers.key(String(propertyName)), valueRendered]
      })
      .filter(Boolean) as string[][],
  )
}

export const successMessage = (message: string) => `${green('Success!')} ${message}`

export const messages = {
  resourceCreated: (resource: Resource) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} created.`),
  resourceDeleted: (resource: Resource) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} deleted.`),
  resource: <$Resource extends Resource>(resource: $Resource, renderers?: ObjectValueRenderersInput<$Resource>) => {
    return messages.table(resource, {
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
  success: successMessage,
}
