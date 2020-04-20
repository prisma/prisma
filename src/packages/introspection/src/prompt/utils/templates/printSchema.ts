import { credentialsToUri, DatabaseCredentials } from '@prisma/sdk'

export const printSchema = ({
  usePhoton,
  credentials,
}: {
  usePhoton: boolean
  credentials: DatabaseCredentials
}): string => `${printCredentials(credentials)}
${
  usePhoton
    ? `
generator client {
  provider = "prisma-client-js"
}`
    : ''
}

model User {
  id    String  @default(cuid()) @id
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}`

const printCredentials = (
  credentials: DatabaseCredentials,
): string => `datasource db {
  provider = "${prettyPrintType(credentials.type)}"
  url      = "${credentialsToUri(credentials)}"
}`

function prettyPrintType(type): any {
  if (type === 'postgres') {
    return 'postgresql'
  }

  return type
}
