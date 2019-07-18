//@ts-check
const Photon = require('@generated/photon')
const express = require('express')
const helmet = require('helmet')
const moment = require('moment')

const photon = new Photon.default()

const app = express()
app.use(helmet())

app.get('*', async (req, res) => {
  const currentTime = moment().format('MMMM Do YYYY, h:mm:ss a')
  let users = await photon.users()
  res.set('Access-Control-Allow-Origin', '*')
  res.status(200).send(`${JSON.stringify(users)} - ${currentTime}`)
})

module.exports = app
