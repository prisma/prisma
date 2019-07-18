//@ts-strict
const Photon = require('./generated/photon')
const express = require('express')

const port = process.env.PORT || 3000
const app = new express()

const photon = new Photon.default()

app.get('/', async (request, response) => {
  const users = await photon.users()
  return response.send(JSON.stringify(users))
})

app.listen(port, () => {
  console.log('Started server on ' + port)
})
