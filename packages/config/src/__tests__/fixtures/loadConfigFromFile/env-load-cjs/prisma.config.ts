import { defineConfig, env } from 'src/index'
import 'dotenv/config' // automatically loads the closest .env file into `process.env`

export default defineConfig({
  datasource: {
    url: env('TEST_CONNECTION_STRING'),
  },
})
