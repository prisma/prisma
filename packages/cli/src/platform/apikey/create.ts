import { arg, Command, isError } from '@prisma/internals'

import {
  getOptionalParameter,
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../../utils/platform'

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
      '--name': String,
      '-n': '--name',
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const payload = await platformRequestOrThrow<{
      data: {
        tenantAPIKey: string
      }
      error: null | { message: string }
    }>({
      token,
      path: `/${workspace}/${project}/settings/api-keys/create`,
      route: '_app.$organizationId_.$projectId.settings.api-keys.create',
      payload: {
        displayName,
      },
    })
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }
    return successMessage(`New API Key created: ${payload.data.tenantAPIKey}`)
  }
}
