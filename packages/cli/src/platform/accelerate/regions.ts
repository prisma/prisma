import { requestOrThrow } from '../_lib/pdp'

export const getRegionsOrThrow = async (input: { token: string }) => {
  const { token } = input

  const { system } = await requestOrThrow<{
    system: {
      accelerate: {
        regions: {
          id: string
          displayName: string
          ppgStatus: 'available' | 'unavailable' | 'unsupported'
        }[]
      }
    }
  }>({
    token,
    body: {
      query: /* GraphQL */ `
        query {
          system {
            accelerate {
              regions {
                id
                displayName
                ppgStatus
              }
            }
          }
        }
      `,
    },
  })

  return system.accelerate.regions
}

export const getPrismaPostgresRegionsOrThrow = async (input: { token: string }) => {
  const regions = await getRegionsOrThrow(input)
  const ppgRegions = regions
    .filter((_) => _.ppgStatus !== 'unsupported')
    .sort((a, b) => b.displayName.localeCompare(a.displayName))

  return ppgRegions
}
