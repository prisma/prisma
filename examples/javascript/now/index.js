const Photon = require('@generated/photon')
const photon = new Photon()

module.exports = async (_, res) => {
  const users = await photon.posts()
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(users))
}
