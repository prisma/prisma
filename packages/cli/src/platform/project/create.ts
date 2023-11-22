import { arg, Command, isError } from '@prisma/internals'

import {
  getOptionalParameter,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.workspace,
      '--display-name': String,
      '-d': '--display-name',
    })
    if (isError(args)) return args
    const token = getRequiredParameterOrThrow(args, ['--token', '-t'], 'PRISMA_TOKEN')
    const workspace = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const displayName = getOptionalParameter(args, ['--display-name', '-d'])
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/overview/create`,
      route: '_app.$organizationId.overview.create',
      payload: {
        displayName,
      },
    })
  }
}
