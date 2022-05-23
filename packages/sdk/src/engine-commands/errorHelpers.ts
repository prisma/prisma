import { enginesVersion } from '@prisma/engines'

import { formatTable } from '../utils/formatTable'
import { version } from '../utils/getVersion'

export function addVersionDetailsToErrorMessage(message: string) {
  const rows = [
    ['prisma', version],
    ['Default Engines Hash', enginesVersion],
  ]
  return `${message}

Versions:
${formatTable(rows)}`
}
