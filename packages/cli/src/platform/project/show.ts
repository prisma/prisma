import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameter, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = getRequiredParameter(args, ['--token', '-t'], 'PRISMA_TOKEN')
    if (isError(token)) return token
    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/overview`,
      route: '_app.$organizationId.overview',
    })
  }
}
