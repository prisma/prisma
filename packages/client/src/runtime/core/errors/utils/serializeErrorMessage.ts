import { SerializableError } from './deserializeErrorMessage'

export function serializeErrorMessage(name: SerializableError, input: any): string {
  const jsonPayload = JSON.stringify({ name, args: input, version: CLIENT_VERSION })
  const payload = Buffer.from(jsonPayload).toString('base64')

  const message = `An error occurred, you can decode its payload with:\n\nnpx prisma@${CLIENT_VERSION} decode-error ${payload}\n`

  return message
}
