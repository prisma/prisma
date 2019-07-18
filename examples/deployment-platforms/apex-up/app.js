//@ts-strict
const Photon = require('./generated/photon')
const express = require('express')

const { PORT = 3000 } = process.env

const binaryName = process.env.BINARY_NAME
console.log({ binaryName })

const app = new express()
const photon = new Photon.default()

app.get('/', async (request, response) => {
  const users = await photon.users()
  return response.send(JSON.stringify(users))
})

app.listen(PORT, () => {
  console.log(`Started server on ${PORT}`)
})
