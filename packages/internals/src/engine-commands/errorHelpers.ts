import { formatTable } from '../utils/formatTable'
import { version } from '../utils/getVersion'

/**
 * Adds `Prisma CLI Version : x.x.x` at the bottom of the error output.
 */
export function addVersionDetailsToErrorMessage(message: string) {
  const rows = [['Prisma CLI Version', version]]
  return `${message}

${formatTable(rows)}`
}
