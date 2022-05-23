import { formatTable } from '../utils/formatTable'
import { version } from '../utils/getVersion'

export function addVersionDetailsToErrorMessage(message: string) {
  const rows = [['Prisma CLI Version', version]]
  return `${message}

${formatTable(rows)}`
}
