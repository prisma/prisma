import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()
  const returnType = await photon.accountConfigurations({
    select: {
      id: true,
      username: true,
      data: {
        select: {
          accountId: true,
        },
      },
    },
  })
  console.log(returnType)
}

main()
