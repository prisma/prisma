import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}

type RIType = 'prisma' | 'foreignKeys' | ''
const referentialIntegrity: RIType = (RI as RIType) || ''

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      referentialIntegrity,
    },
    {
      provider: Providers.MYSQL,
      referentialIntegrity,
    },
    {
      provider: Providers.COCKROACHDB,
      referentialIntegrity,
    },
    {
      provider: Providers.SQLSERVER,
      referentialIntegrity,
    },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
