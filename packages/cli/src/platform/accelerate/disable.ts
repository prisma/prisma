import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow, platformParameters, platformRequestOrThrow } from '../../helpers'

export class Disable implements Command {
  public static new(): Disable {
    return new Disable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = getRequiredParameterOrThrow(args, ['--token', '-t'], 'PRISMA_TOKEN')
    const workspace = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const project = getRequiredParameterOrThrow(args, ['--project', '-p'])
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/${project}/accelerate/settings`,
      route: '_app.$organizationId_.$projectId.accelerate.settings',
      payload: {
        intent: 'disable',
        projectId: project,
      },
    })
  }
}
