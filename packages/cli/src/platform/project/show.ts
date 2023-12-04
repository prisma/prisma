import { arg, Command, isError } from '@prisma/internals'
import { table } from 'console'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace

    const payload = await platformRequestOrThrow<{
      organization: { projects: { id: string; createdAt: string; displayName: string }[] }
    }>({
      token,
      path: `/${workspace}/overview`,
      route: '_app.$organizationId.overview',
    })

    table(payload.organization.projects, ['id', 'createdAt', 'displayName'])

    return ''
  }
}
