import { DatabaseCredentials } from '../../../types'
import { credentialsToUri } from '../../../convertCredentials'

export const printSchema = ({
  usePhoton,
  credentials,
}: {
  usePhoton: boolean
  credentials: DatabaseCredentials
}) => `${printCredentials(credentials)}
${
  usePhoton
    ? `
generator photon {
  provider = "photonjs"
}`
    : ''
}

model User {
  id    String  @default(cuid()) @id @unique
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}`

const printCredentials = (credentials: DatabaseCredentials) => `datasource db {
  provider = "${prettyPrintType(credentials.type)}"
  url      = "${credentials.uri || credentialsToUri(credentials)}"
}`

function prettyPrintType(type) {
  if (type === 'postgres') {
    return 'postgresql'
  }

  return type
}
