const { spawn } = require('child_process')

const child = spawn('node', ['mock-command.js'])
child.stdout.on('data', data => {
  console.log(data.toString())
})
