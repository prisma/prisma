import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const mongoDBMatrixBase = {
  provider: Providers.MONGODB,
  id: 'String @id @map("_id")',
  relationMode: 'prisma',
}

export default defineMatrix(() => [
  [
    {
      ...mongoDBMatrixBase,
      onUpdate: 'DEFAULT',
      onDelete: 'DEFAULT',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'Cascade',
      onDelete: 'Cascade',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'NoAction',
      onDelete: 'NoAction',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'SetNull',
      onDelete: 'SetNull',
    },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
