import { arg, Command, isError } from '@prisma/internals'
import { log } from 'console'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Disable implements Command {
  public static new(): Disable {
    return new Disable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const payload = await platformRequestOrThrow<{ data: {}; error: null | { message: string } }>({
      token,
      path: `/${workspace}/${project}/accelerate/settings`,
      route: '_app.$organizationId_.$projectId.accelerate.settings',
      payload: {
        intent: 'disable',
        projectId: project,
      },
    })
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }
    // green "success" text
    log(
      `Success! Accelerate disabled. Prisma clients connected to ${args['--project']} will not be able to send queries through Accelerate.`,
    )
    return ''
  }
}
