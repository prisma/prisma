import { defineConfig } from 'src/index'
import 'dotenv/config' // automatically loads the closest .env file into `process.env`

export default defineConfig({
  earlyAccess: true,
})
