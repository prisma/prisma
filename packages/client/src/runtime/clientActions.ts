import { DMMF } from './dmmf-types'

// these actions do not exist on DMMF
// they wrap one of the existing actions and
// implement some logic on top of them
export const clientOnlyActions = {
  findUniqueOrThrow: {
    wrappedAction: DMMF.ModelAction.findUnique,
  },

  findFirstOrThrow: {
    wrappedAction: DMMF.ModelAction.findFirst,
  },
} as const

export type ClientOnlyModelAction = keyof typeof clientOnlyActions

export type ClientModelAction = DMMF.ModelAction | ClientOnlyModelAction

export function getDmmfActionName(name: ClientModelAction): DMMF.ModelAction {
  if (isClientOnlyAction(name)) {
    return clientOnlyActions[name].wrappedAction
  }
  return name
}

export function isClientOnlyAction(action: string): action is ClientOnlyModelAction {
  return Object.prototype.hasOwnProperty.call(clientOnlyActions, action)
}

export const allClientModelActions = (Object.keys(DMMF.ModelAction) as ClientModelAction[]).concat(
  Object.keys(clientOnlyActions) as ClientModelAction[],
)
