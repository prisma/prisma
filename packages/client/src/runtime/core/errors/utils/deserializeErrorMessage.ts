import { throwValidationException } from '../../errorRendering/throwValidationException'

type Payload = { name: SerializableError; args: any; version: string }

export function deserializeErrorMessage(payload: string, cliVersion: string) {
  try {
    const jsonPayload = Buffer.from(payload, 'base64').toString()
    const { name, args, version } = JSON.parse(jsonPayload) as Payload

    if (version !== cliVersion) {
      throw new Error(
        `The Prisma CLI version (${cliVersion}) is not compatible with the provided error message (${version}).`,
      )
    }

    try {
      if (name === SerializableError.THROW_VALIDATION_EXCEPTION) {
        return throwValidationException(args)
      }
    } catch (e) {
      return e.message
    }
  } catch (e) {
    if (payload === undefined || payload === null || payload === '') {
      throw new Error(`Could not deserialize the error message. The provided input is empty.`)
    }
    throw new Error(`Could not deserialize the error message. The provided input is invalid.`)
  }
}

export enum SerializableError {
  THROW_VALIDATION_EXCEPTION = 'THROW_VALIDATION_EXCEPTION',
}
