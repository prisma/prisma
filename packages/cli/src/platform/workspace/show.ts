import { arg, Command, isError } from '@prisma/internals'

import { getPlatformToken, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.global,
    })
    if (isError(args)) return args
    const token = await getPlatformToken(args)
    if (isError(token)) return token
    return platformRequestOrThrow({
      token,
      path: `/settings/workspaces`,
      route: '_app._user.settings.workspaces',
    }) as Promise<any>
  }
}
