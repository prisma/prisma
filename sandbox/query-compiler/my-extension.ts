// import { Prisma } from './prisma/client/client'
// import { Prisma } from '@prisma/client/extension'
import { Prisma } from '@prisma/client/extension'


// Define the extension
export const myExtension = Prisma.defineExtension({
  name: 'myDemoExtension',
  model: {
    $allModels: {
        foo: () => {
            return 'bar'
        }
    }
  },
})