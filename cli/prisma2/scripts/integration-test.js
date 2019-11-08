const { Photon } = require('../tmp')

async function main() {
  const photon = new Photon()
  const result = await photon.teams.findMany()
  console.log(result)
  photon.disconnect()
}

main()
