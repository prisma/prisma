// import { Prisma } from './prisma/client/client'
// import { Prisma } from '@prisma/client/extension'
import { Prisma } from './prisma/client/client'
import { PrismaClientInitializationError as ErrExt, Decimal as DecimalExt, Prisma as PrismaExt } from '@prisma/client/extension'

const ErrA = Prisma.PrismaClientInitializationError

console.log(ErrA)
console.log(ErrExt)

const a = new ErrA('test', '1.0.0', 'foo')
const c = new ErrExt('test', '1.0.0', 'foo')

// With the new extracted utilities, the errors are properly all the same instance no matter from where they are imported from
console.log(a instanceof ErrA)
console.log(a instanceof ErrExt)
console.log(c instanceof ErrA)
console.log(c instanceof ErrExt)


const decA = new Prisma.Decimal(1.1)
const decC = new DecimalExt(1.1)

console.log(decA)
console.log(decC)

console.log(Prisma.Decimal === DecimalExt)

console.log(decA instanceof Prisma.Decimal)
console.log(decA instanceof DecimalExt)
console.log(decC instanceof Prisma.Decimal)
console.log(decC instanceof DecimalExt)

// Define the extension
export const myExtension = PrismaExt.defineExtension({
  name: 'myDemoExtension',
  model: {
    $allModels: {
        foo: () => {
            return 'bar'
        }
    }
  },
})