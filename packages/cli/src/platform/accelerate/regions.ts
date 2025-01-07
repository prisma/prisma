import { requestOrThrow } from '../_lib/pdp'

export const getRegions = async (input: { token: string }) => {
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
