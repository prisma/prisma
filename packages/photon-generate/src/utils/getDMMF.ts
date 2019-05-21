import { DMMF as DMMFComponent } from '@prisma/dmmf'
import { generateCRUDSchema } from 'prisma-generate-schema'
import { DatabaseType } from 'prisma-datamodel'
import { DMMF } from '../runtime/dmmf-types'
import { getUnionDocument } from '../runtime/getUnionDocument'

export function getDMMF(datamodel: string): DMMF.Document {
  const schema = generateCRUDSchema(datamodel, DatabaseType.postgres)
  const dmmf: DMMF.Document<DMMF.RawSchemaArg> = JSON.parse(JSON.stringify(new DMMFComponent(datamodel, schema)))
  return getUnionDocument(dmmf)
}

console.log(
  JSON.stringify(
    getDMMF(`type User {
  id: ID! @id
  name: String!
  strings: [String]
  posts: [Post] @relation(link: INLINE)
}

type Profile {
  id: ID! @id
  url: String!
}

type Post {
  id: ID! @id
  title: String!
  content: String!
  author: User!
}`),
    null,
    2,
  ),
)
