const Photon = require('@generated/photon')

const photon = new Photon.default()
exports.photonExample = async function helloWorld(req, res) {
  const users = await photon.users()
  res.status(200).send(JSON.stringify(users))
}
