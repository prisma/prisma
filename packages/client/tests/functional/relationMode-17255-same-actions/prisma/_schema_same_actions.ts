import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_same_actions({
  id,
  referentialActionLineOutput,
}: {
  id: string
  referentialActionLineOutput: ReferentialActionLineOutput
}) {
  const { referentialActionLine } = referentialActionLineOutput

  return /* Prisma */ `
model Main {
  id ${id}

  alice   Alice?  @relation(fields: [aliceId], references: [id] ${referentialActionLine})
  aliceId String?

  bob Bob?
}

model Alice {
  id ${id}
  manyMains Main[]
}

model Bob {
  id ${id}

  main   Main   @relation(fields: [mainId], references: [id] ${referentialActionLine})
  mainId String @unique
}
  `
}
