const sqlId = 'String @id @default(uuid())'
const mongoDbId = 'String @id @default(auto()) @map("_id") @db.ObjectId'

export function idForProvider(provider: string): string {
  return provider === 'mongodb' ? mongoDbId : sqlId
}
