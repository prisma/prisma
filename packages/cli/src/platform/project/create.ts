import { arg, Command, isError } from '@prisma/internals'

import {
  getOptionalParameter,
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../../utils/platform'

type Payload =
  | { data: { id: string; createdAt: string; displayName: string }; error: null }
  | {
      data: null
      error: {
        name: string
        message: string
      }
    }

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.workspace,
      '--name': String,
      '-n': '--name',
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace

    const displayName = getOptionalParameter(args, ['--name', '-n'])

    const payload = await platformRequestOrThrow<Payload>({
      token,
      path: `/${workspace}/overview/create`,
      route: '_app.$organizationId.overview.create',
      payload: {
        displayName,
      },
    })
    if (payload.error) throw new Error(`${payload.error.name}: ${payload.error.message}`)

    return successMessage(`Project ${payload.data.displayName} - ${payload.data.id} created.`)
  }
}
