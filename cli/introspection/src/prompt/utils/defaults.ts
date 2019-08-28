import { DatabaseType } from 'prisma-datamodel'
import { DatabaseCredentials } from '../../types'

export const sqliteDefault: DatabaseCredentials = {
  type: DatabaseType.sqlite,
  uri: 'file:dev.db',
}
