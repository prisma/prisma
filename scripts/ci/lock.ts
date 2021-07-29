const client = require('redis').createClient({
  url: process.env.REDIS_URL,
})
const { promisify } = require('util')
const lock = promisify(require('redis-lock')(client))

async function main() {
  console.log('getting lock...')
  console.log(new Date())
  const unlock = await lock('lockString2', 1000 * 1000)
  console.log('got lock')
  // Perform your task;
  await new Promise(r => setTimeout(r, 1000 * 1000))
  console.log('released lock')
  console.log(new Date())
  unlock()
}

main()
