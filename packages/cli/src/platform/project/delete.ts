import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../../utils/platform'

type Payload =
  | {
      data: {
        id: string
        createdAt: string
        displayName: string
      }
      error: null
    }
  | {
      data: null
      error: {
        name: string
        message: string
      }
    }
export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
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

    const payload = await platformRequestOrThrow<Payload>({
      token,
      path: `/${workspace}/${project}/settings/general`,
      route: '_app.$organizationId_.$projectId.settings.general',
      payload: {
        intent: 'delete',
      },
    })
    if (payload.error) throw new Error(`${payload.error.name}: ${payload.error.message}`)

    return successMessage(`Project ${payload.data.displayName} - ${payload.data.id} deleted.`)
  }
}
