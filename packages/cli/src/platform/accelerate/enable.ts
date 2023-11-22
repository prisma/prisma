import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameter, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Enable implements Command {
  public static new(): Enable {
    return new Enable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
      '--url': String,
    })
    if (isError(args)) return args
    const token = getRequiredParameter(args, ['--token', '-t'], 'PRISMA_TOKEN')
    if (isError(token)) return token
    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const url = getRequiredParameter(args, ['--url'])
    if (isError(token)) return token
    return platformRequestOrThrow({
      token,
      path: `/${workspace}/${project}/accelerate/setup`,
      route: '_app.$organizationId_.$projectId.accelerate.setup',
      payload: {
        intent: 'enable',
        connectionString: url,
      },
    })
  }
}
