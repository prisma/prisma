import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow, platformParameters, platformRequestOrThrow } from '../../helpers'

export class Enable implements Command {
  public static new(): Enable {
    return new Enable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
      '--url': String,
    })
    if (isError(args)) throw args
    const token = getRequiredParameterOrThrow(args, ['--token', '-t'], 'PRISMA_TOKEN')
    const workspace = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const project = getRequiredParameterOrThrow(args, ['--project', '-p'])
    const url = getRequiredParameterOrThrow(args, ['--url'])
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
