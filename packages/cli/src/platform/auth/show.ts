import { arg, Command, formatTable, isError } from '@prisma/internals'
import { green } from 'kleur/colors'

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
    const payload = await platformRequestOrThrow<{
      user: { id: string; handle: string; email: string; displayName: string }
    }>({
      token,
      path: `/settings/account`,
      route: '_app._user.settings.account',
    })
    console.info(`Currently authenticated as ${green(payload.user.email)}\n`)
    return formatTable([
      ['id', payload.user.id],
      ['handle', payload.user.handle],
      ['email', payload.user.email],
      ['displayName', payload.user.displayName],
    ])
  }
}
