import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model User {
  id         ${idForProvider(provider)}
  name       String
  walletLink WalletLink[]
}

model Wallet {
  id         ${idForProvider(provider)}
  name       String
  walletLink WalletLink[]
}

model WalletLink {
  id        ${idForProvider(provider)}
  name      String
  wallet    Wallet @relation(fields: [walletId], references: [id])
  user      User @relation(fields: [userId], references: [id])
  walletId  String
  userId    String
}
`
})
