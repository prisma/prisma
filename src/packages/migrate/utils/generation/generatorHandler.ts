export function generatorHandler(cb: (options: any) => any) {
  let input = ''
  process.stdin.on('data', chunk => {
    input += chunk.toString()
  })
  process.stdin.on('end', () => {
    const options = JSON.parse(input)
    cb(options)
  })
  process.stdin!.resume()
}
