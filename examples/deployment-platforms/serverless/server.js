//@ts-strict
const Photon = require('@generated/photon')

const photon = new Photon()

module.exports.handler = async event => {
  if (event.httpMethod === 'GET') {
    const users = await photon.users()
    // const users = ['hi']

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
