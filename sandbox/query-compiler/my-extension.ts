// import { Prisma } from './prisma/client/client'
// import { Prisma } from '@prisma/client/extension'
import { Prisma } from './prisma/client/client'
import { PrismaClientInitializationError as ErrExt, Decimal as DecimalExt, Prisma as PrismaExt, DbNull, objectEnumValues } from '@prisma/client/extension'

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

console.log(Prisma.DbNull)
console.log(DbNull)
console.log(objectEnumValues.instances.DbNull)
// TODO: we have an issue with the branded types here on the type level only - at runtime the values are actually equal as it seems
// @ts-expect-error - TODO: still need to solve this: This comparison appears to be unintentional because the types 'DbNull' and '{ readonly "__#1@#_brand_DbNull": void; _getNamespace(): string; _getName(): string; toString(): string; }' have no overlap.
console.log(Prisma.DbNull === DbNull)
// @ts-expect-error - TODO: still need to solve this: This comparison appears to be unintentional because the types 'DbNull' and 'DbNull_2' have no overlap.
console.log(Prisma.DbNull === objectEnumValues.instances.DbNull)
// @ts-expect-error - TODO: still need to solve this: This comparison appears to be unintentional because the types '{ readonly "__#1@#_brand_DbNull": void; _getNamespace(): string; _getName(): string; toString(): string; }' and 'DbNull_2' have no overlap.
console.log(DbNull === objectEnumValues.instances.DbNull)

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