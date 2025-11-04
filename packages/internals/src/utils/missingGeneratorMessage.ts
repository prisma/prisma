import { blue, bold } from 'kleur/colors'

import { highlightDatamodel } from '../highlight/highlight'
import { link } from './link'

export const missingGeneratorMessage = `\n${blue('info')} You don't have any generators defined in your ${bold(
  'schema.prisma',
)}, so nothing will be generated.
Add the Prisma Client generator like this:

${bold(
  highlightDatamodel(`generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/prisma-schema')}
`

export const missingModelMessage = `\nYou don't have any ${bold('models')} defined in your ${bold(
  'schema.prisma',
)}, so nothing will be generated.
You can define a model like this:

${bold(
  highlightDatamodel(`model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/prisma-schema')}
`

export const missingModelMessageMongoDB = `\nYou don't have any ${bold('models')} defined in your ${bold(
  'schema.prisma',
)}, so nothing will be generated.
You can define a model like this:

${bold(
  highlightDatamodel(`model User {
  id    String  @id @default(auto()) @map("_id") @db.ObjectId
  email String  @unique
  name  String?
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/prisma-schema')}
`
