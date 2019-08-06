const Photon = require('./generated/photon')

const photon = new Photon.default()

exports.handler = async function(event, context, callback) {
  const users = await photon.users()
  return {
    statusCode: 200,
    body: JSON.stringify(users),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  }
}
