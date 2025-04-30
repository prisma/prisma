import { bench } from '@ark/attest'

bench('prisma schemas', () => {
  return {} as InstanceType<typeof import('./generated/index.js').PrismaClient>
}).types([31870, 'instantiations'])
