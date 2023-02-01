import { Providers } from '../../_utils/providers'
import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_mixed_action({
  id,
  provider,
  referentialActionLineOutput,
}: {
  id: string
  provider: Providers
  referentialActionLineOutput: ReferentialActionLineOutput
}) {
  return /* Prisma */ `
model Main {
  id ${id}

  alice   Alice?  @relation(fields: [aliceId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  aliceId String? 

  bob Bob?
}

model Alice {
  id ${id}
  manyMains Main[]
}

model Bob {
  id ${id}

  main   Main   @relation(fields: [mainId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  mainId String @unique 
}
  `
}
