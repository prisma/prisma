import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow, platformParameters, platformRequestOrThrow } from '../../helpers'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) throw args
    const token = getRequiredParameterOrThrow(args, ['--token', '-t'], 'PRISMA_TOKEN')
    const workspace = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const project = getRequiredParameterOrThrow(args, ['--project', '-p'])
    if (isError(args)) throw args
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/${project}/settings/general`,
      route: '_app.$organizationId_.$projectId.settings.general',
      payload: {
        intent: 'delete',
      },
    })
  }
}
