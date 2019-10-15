import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()
  const returnType = await photon.accountConfigurations({
    select: {
      id: true,
      username2: true,
      data: {
        select: {
          accountId: true,
        },
      },
    },
    
  } as any)
  console.log(returnType)
}

main()
