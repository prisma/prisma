import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'
import { schema_1ton } from './_schema_1_to_n'
import { schema_mton } from './_schema_m_to_n'

const PLANETSCALE = false
// const PLANETSCALE = true

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  // if referentialIntegrity is not defined, we do not add the line
  // if referentialIntegrity is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const referentialIntegrityLine =
    provider === Providers.MONGODB || !referentialIntegrity ? '' : `referentialIntegrity = "${referentialIntegrity}"`
  let referentialActionLine = ''
  if (referentialActions.onUpdate && referentialActions.onUpdate !== 'DEFAULT') {
    referentialActionLine += `, onUpdate: ${referentialActions.onUpdate}`
  }
  if (referentialActions.onDelete && referentialActions.onDelete !== 'DEFAULT') {
    referentialActionLine += `, onDelete: ${referentialActions.onDelete}`
  }

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  ${
    PLANETSCALE && provider === Providers.MYSQL
      ? `url = "mysql://root:root@127.0.0.1:33807/PRISMA_DB_NAME"`
      : `url = env("DATABASE_URI_${provider}")`
  }
  ${referentialIntegrityLine}
}
  `

  return /* Prisma */ `
${schemaHeader}

${schema_1to1(id, provider, referentialActionLine)}

${schema_1ton(id, provider, referentialActionLine)}

${schema_mton(id, provider, referentialActionLine)}
`
})
