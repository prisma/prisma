const fs = require('fs')

async function main() {
  fs.watch('datamodel.prisma', () => {
    console.log('lol')
  })
}

main()
