import { Hook } from 'require-in-the-middle'

function main() {
  new Hook(['@prisma/client'], {}, (exports, name) => {
    console.log('loaded %s', name)

    return exports
  })

  require('@prisma/client')
}

void main()
