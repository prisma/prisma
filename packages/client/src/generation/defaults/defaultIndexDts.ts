export const defaultIndexDts = `/**
* ##  Prisma Client ʲˢ
*
* Type-safe database client for TypeScript & Node.js
* @example
* \`\`\`
* const prisma = new Prisma()
* // Fetch zero or more Users
* const users = await prisma.user.findMany()
* \`\`\`
*
*
* Read more in our [docs](https://github.com/prisma/prisma/blob/main/docs/prisma-client-js/api.md).
*/
export declare const PrismaClient: any
/**
* ##  Prisma Client ʲˢ
*
* Type-safe database client for TypeScript & Node.js
* @example
* \`\`\`
* const prisma = new Prisma()
* // Fetch zero or more Users
* const users = await prisma.user.findMany()
* \`\`\`
*
*
* Read more in our [docs](https://github.com/prisma/prisma/blob/main/docs/prisma-client-js/api.md).
*/
export declare type PrismaClient = any

export declare const dmmf: any
export declare type dmmf = any

/**
* Get the type of the value, that the Promise holds.
*/
export declare type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T

/**
* Get the return type of a function which returns a Promise.
*/
export declare type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>
`
