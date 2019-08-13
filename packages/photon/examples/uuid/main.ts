import uuidv1 from 'uuid/v4'
import Photon from './@generated/photon'

const main = async () => {
  const photon = new Photon()
  await photon.vaults.create({
    data: {
      id: uuidv1(),
      createdAtTick: 0,
      x: 1,
      y: 1,
      resourceId: uuidv1(),
      facilityId: uuidv1(),
    },
  })
}

main()
