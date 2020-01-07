import { Photon, Artist } from './@generated/photon'

async function main() {
  const photon = new Photon({ debug: true })
  console.clear()
  // const result = await photon.artists({
  //   where: {
  //     Albums: {
  //       some: {
  //         Tracks: {
  //           some: {
  //             AND: {
  //               UnitPrice: 5,
  //               Playlists: {
  //                 some: {
  //                   Tracks: {
  //                     some: {
  //                       Name: '',
  //                       Genre: {
  //                         id: 5,
  //                       },
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  const result = await photon.artists({
    where: {},
  })
  console.dir(result, { depth: null })
  photon.close()
}

main().catch(console.error)
