import { green } from 'kleur/colors'

export const messages = {
  resourceCreated: (resource: { __typename: string; id: string; displayName: string }) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} created.`),
  resourceDeleted: (resource: { __typename: string; id: string; displayName: string }) =>
    successMessage(`${resource.__typename} ${resource.displayName} - ${resource.id} deleted.`),
}

export const successMessage = (message: string) => `${green('Success!')} ${message}`
