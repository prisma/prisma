// import { Prisma } from './prisma/client/client'
// import { Prisma } from '@prisma/client/extension'
import { Prisma } from './prisma/client/client'
import { PrismaClientInitializationError as ErrExt } from '@prisma/client/extension'
import { PrismaClientInitializationError as ErrB } from '@prisma/client/runtime/utilities'

const ErrA = Prisma.PrismaClientInitializationError

console.log(ErrA)
console.log(ErrB)
console.log(ErrExt)

const a = new ErrA('test', '1.0.0', 'foo')
const b = new ErrB('test', '1.0.0', 'foo')
const c = new ErrExt('test', '1.0.0', 'foo')

// With the new extracted utilities, the errors are properly all the same instance no matter from where they are imported from
console.log(a instanceof ErrA)
console.log(a instanceof ErrB)
console.log(a instanceof ErrExt)
console.log(b instanceof ErrA)
console.log(b instanceof ErrB)
console.log(b instanceof ErrExt)
console.log(c instanceof ErrA)
console.log(c instanceof ErrB)
console.log(c instanceof ErrExt)

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