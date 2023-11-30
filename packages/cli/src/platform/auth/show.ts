import { arg, Command, isError } from '@prisma/internals'

import { getPlatformTokenOrThrow, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.global,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    return platformRequestOrThrow({
      token,
      path: `/settings/account`,
      route: '_app._user.settings.account',
    }) as Promise<any>
  }
}
