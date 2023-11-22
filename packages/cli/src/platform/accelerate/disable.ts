import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameter, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Disable implements Command {
  public static new(): Disable {
    return new Disable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = getRequiredParameter(args, ['--token', '-t'], 'PRISMA_TOKEN')
    if (isError(token)) return token
    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
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
