const sqlId = 'String @id @default(uuid())'
const cockroachId = 'String @id @default(cuid())'
const mongoDbId = 'String @id @default(auto()) @map("_id") @db.ObjectId'

export function idForProvider(provider: string): string {
  switch (provider) {
    case 'cockroachdb':
      return cockroachId
    case 'mongodb':
      return mongoDbId
    default:
      return sqlId
  }
}
