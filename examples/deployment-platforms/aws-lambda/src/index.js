//@ts-strict
const Photon = require('@generated/photon')

const photon = new Photon.default()
module.exports.index = async (event, ctx, callback) => {
  console.log({ time })
  if (event.httpMethod === 'GET') {
    const users = await photon.users()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: JSON.stringify(users),
    }
  }
  throw new Error('Method not allowed')
}
