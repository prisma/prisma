import { arg, Command, isError } from '@prisma/internals'

import { platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.global,
    })
    if (isError(args)) return args
    return platformRequestOrThrow({
      path: `/settings/workspaces`,
      route: '_app._user.settings.workspaces',
    }) as Promise<any>
  }
}
