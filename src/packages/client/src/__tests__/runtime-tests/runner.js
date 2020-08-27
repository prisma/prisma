const pidtree = require('pidtree')
const stripAnsi = require('strip-ansi')

process.on('message', (msg) => {
  const { filePath } = JSON.parse(msg)
  const mod = require(filePath)
  mod()
    .then((data) => {
      process.send(
        JSON.stringify({
          success: true,
          data,
        }),
      )
    })
    .catch((error) => {
      process.send(
        JSON.stringify({
          success: false,
          error: stripAnsi(error.message),
        }),
      )
    })
    .finally(async () => {
      const pids = await pidtree(process.pid)
      for (const pid of pids) {
        try {
          process.kill(pid)
        } catch (e) {
          // console.error(e)
        }
      }
      process.exit()
    })
})
