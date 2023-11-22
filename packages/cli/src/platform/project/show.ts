import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow, platformParameters, platformRequestOrThrow } from '../../helpers'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = getRequiredParameterOrThrow(args, ['--token', '-t'], 'PRISMA_TOKEN')
    const workspace = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/overview`,
      route: '_app.$organizationId.overview',
    })
  }
}
