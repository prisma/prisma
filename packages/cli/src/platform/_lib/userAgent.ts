import Debug from '@prisma/debug'
import { isError } from '@prisma/internals'
import * as Checkpoint from 'checkpoint-client'

import { version as PRISMA_CLI_VERSION } from '../../../package.json'
import { unknownToError } from './prelude'

const debug = Debug('prisma:cli:platform:_lib:userAgent')

export const getUserAgent = async () => {
  const signature = await Checkpoint.getSignature().catch(unknownToError)
  if (isError(signature)) debug(`await checkpoint.getSignature() failed silently with ${signature.message}`) // prettier-ignore
  const signatureString = isError(signature) ? 'unknown' : signature
  return `prisma-cli/${PRISMA_CLI_VERSION} (Signature: ${signatureString})`
}
