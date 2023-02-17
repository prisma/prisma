import { runMeasurement } from './base.js'

runMeasurement()
  .then((results) => console.log(JSON.stringify(results)))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
