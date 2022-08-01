import { computeMatrix } from '../_referential-integrity-utils/computeMatrix'
import { defineMatrix } from '../_utils/defineMatrix'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}

type RIType = 'prisma' | 'foreignKeys' | ''
const referentialIntegrity: RIType = (RI as RIType) || ''

const matrix = computeMatrix({ referentialIntegrity })

export default defineMatrix(() => [
  matrix,
  [
    { previewFeatures: '"referentialIntegrity"' },
  ],
])
