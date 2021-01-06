export interface CommonCodeParams {
  runtimePath: string
  clientVersion: string
  engineVersion: string
  browser?: boolean
}

export const commonCodeJS = ({
  runtimePath,
  browser,
  clientVersion,
  engineVersion,
}: CommonCodeParams): string => `
Object.defineProperty(exports, "__esModule", { value: true });
${
  browser
    ? `
const {
  Decimal
} = require('${runtimePath}/index-browser')
`
    : `
const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  warnEnvConflicts,
  getPrismaClient,
  debugLib,
  sqltag,
  empty,
  join,
  raw,
  Decimal
} = require('${runtimePath}')

const path = require('path')
const debug = debugLib('prisma-client')
`
}

const Prisma = {}

exports.Prisma = Prisma

/**
 * Prisma Client JS version: ${clientVersion}
 * Query Engine version: ${engineVersion}
 */
Prisma.prismaVersion = {
  client: "${clientVersion}",
  engine: "${engineVersion}"
}

Prisma.PrismaClientKnownRequestError = ${notSupportOnBrowser(
  'PrismaClientKnownRequestError',
  browser,
)};
Prisma.PrismaClientUnknownRequestError = ${notSupportOnBrowser(
  'PrismaClientUnknownRequestError',
  browser,
)}
Prisma.PrismaClientRustPanicError = ${notSupportOnBrowser(
  'PrismaClientRustPanicError',
  browser,
)}
Prisma.PrismaClientInitializationError = ${notSupportOnBrowser(
  'PrismaClientInitializationError',
  browser,
)}
Prisma.PrismaClientValidationError = ${notSupportOnBrowser(
  'PrismaClientValidationError',
  browser,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */

Prisma.sql = ${notSupportOnBrowser('sqltag', browser)}
Prisma.empty = ${notSupportOnBrowser('empty', browser)}
Prisma.join = ${notSupportOnBrowser('join', browser)}
Prisma.raw = ${notSupportOnBrowser('raw', browser)}
`
export const notSupportOnBrowser = (fnc: string, browser?: boolean) => {
  if (browser)
    return `() => {
  throw new Error(\`${fnc} is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues\`,
)}`
  return fnc
}
export const commonCodeTS = ({
  runtimePath,
  clientVersion,
  engineVersion,
}: CommonCodeParams) => ({
  tsWithoutNamespace: () => `import * as runtime from '${runtimePath}';

${commonCodeTS({ runtimePath, clientVersion, engineVersion }).ts(true)}
`,
  ts: (hideFetcher?: boolean) => `export import DMMF = runtime.DMMF

/**
 * Prisma Errors
 */
export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
export import PrismaClientValidationError = runtime.PrismaClientValidationError

/**
 * Re-export of sql-template-tag
 */
export import sql = runtime.sqltag
export import empty = runtime.empty
export import join = runtime.join
export import raw = runtime.raw
export import Sql = runtime.Sql

/**
 * Decimal.js
 */
export import Decimal = runtime.Decimal

/**
 * Prisma Client JS version: ${clientVersion}
 * Query Engine version: ${engineVersion}
 */
export type PrismaVersion = {
  client: string
}

export const prismaVersion: PrismaVersion 

/**
 * Utility Types
 */

/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON object.
 * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
 */
export type JsonObject = {[Key in string]?: JsonValue}
 
/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON array.
 */
export interface JsonArray extends Array<JsonValue> {}
 
/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches any valid JSON value.
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray

/**
 * Same as JsonObject, but allows undefined
 */
export type InputJsonObject = {[Key in string]?: JsonValue}
 
export interface InputJsonArray extends Array<JsonValue> {}
 
export type InputJsonValue = undefined |  string | number | boolean | null | InputJsonObject | InputJsonArray
 type SelectAndInclude = {
  select: any
  include: any
}
type HasSelect = {
  select: any
}
type HasInclude = {
  include: any
}
type CheckSelect<T, S, U> = T extends SelectAndInclude
  ? 'Please either choose \`select\` or \`include\`'
  : T extends HasSelect
  ? U
  : T extends HasInclude
  ? U
  : S

/**
 * Get the type of the value, that the Promise holds.
 */
export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

/**
 * Get the return type of a function which returns a Promise.
 */
export type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>


export type Enumerable<T> = T | Array<T>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

export type TruthyKeys<T> = {
  [key in keyof T]: T[key] extends false | undefined | null ? never : key
}[keyof T]

export type TrueKeys<T> = TruthyKeys<Pick<T, RequiredKeys<T>>>

/**
 * Subset
 * @desc From \`T\` pick properties that exist in \`U\`. Simple version of Intersection
 */
export type Subset<T, U> = {
  [key in keyof T]: key extends keyof U ? T[key] : never;
};

/**
 * Subset + Intersection
 * @desc From \`T\` pick properties that exist in \`U\` and intersect \`K\`
 */
export type SubsetIntersection<T, U, K> = {
  [key in keyof T]: key extends keyof U ? T[key] : never
} &
  K

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * XOR is needed to have a real mutually exclusive union type
 * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
 */
type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;


/**
 * Is T a Record?
 */
type IsObject<T extends any> = T extends Array<any>
? False
: T extends Date
? False
: T extends Buffer
? False
: T extends BigInt
? False
: T extends object
? True
: False


/**
 * If it's T[], return T
 */
export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

/**
 * From ts-toolbelt
 */

export type Union = any

/** Helper Types for "Merge" **/
export type IntersectOf<U extends Union> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
} & {};

type _Merge<U extends object> = IntersectOf<Overwrite<U, {
    [K in keyof U]-?: At<U, K>;
}>>;

type Key = string | number | symbol;
type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
type AtStrict<O extends object, K extends Key> = O[K & keyof O];
type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
}[strict];

export type ComputeRaw<A extends any> = A extends Function ? A : {
  [K in keyof A]: A[K];
} & {};

export type OptionalFlat<O> = {
  [K in keyof O]?: O[K];
} & {};

type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<Record<Exclude<Keys<_U>, keyof U>, never>> : never;

export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
/** End Helper Types for "Merge" **/

export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

/**
A [[Boolean]]
*/
export type Boolean = True | False

// /**
// 1
// */
export type True = 1

/**
0
*/
export type False = 0

export type Not<B extends Boolean> = {
  0: 1
  1: 0
}[B]

export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
  ? 0 // anything \`never\` is false
  : A1 extends A2
  ? 1
  : 0

export type Has<U extends Union, U1 extends Union> = Not<
  Extends<Exclude<U1, U>, U1>
>

export type Or<B1 extends Boolean, B2 extends Boolean> = {
  0: {
    0: 0
    1: 1
  }
  1: {
    0: 1
    1: 1
  }
}[B1][B2]

export type Keys<U extends Union> = U extends unknown ? keyof U : never



/**
 * Used by group by
 */

export type GetScalarType<T, O> = O extends object ? {
  [P in keyof T]: P extends keyof O
    ? O[P]
    : never
} : never

type FieldPaths<
  T,
  U = Omit<T, 'avg' | 'sum' | 'count' | 'min' | 'max'>
> = IsObject<T> extends True ? U : T

type GetHavingFields<T> = {
  [K in keyof T]: Or<
    Or<Extends<'OR', K>, Extends<'AND', K>>,
    Extends<'NOT', K>
  > extends True
    ? // infer is only needed to not hit TS limit
      // based on the brilliant idea of Pierre-Antoine Mills
      // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
      T[K] extends infer TK
      ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
      : never
    : {} extends FieldPaths<T[K]>
    ? never
    : K
}[keyof T]

/**
 * Convert tuple to union
 */
type _TupleToUnion<T> = T extends (infer E)[] ? E : never
type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

/**
 * Like \`Pick\`, but with an array
 */
type PickArray<T, K extends Array<keyof T>> = Pick<T, TupleToUnion<K>>

${
  !hideFetcher
    ? `class PrismaClientFetcher {
  private readonly prisma;
  private readonly debug;
  private readonly hooks?;
  constructor(prisma: PrismaClient<any, any>, debug?: boolean, hooks?: Hooks | undefined);
  request<T>(document: any, dataPath?: string[], rootField?: string, typeName?: string, isList?: boolean, callsite?: string): Promise<T>;
  sanitizeMessage(message: string): string;
  protected unpack(document: any, data: any, path: string[], rootField?: string, isList?: boolean): any;
}`
    : ''
}
`,
})

export const commonCodeMJS = ({
  runtimePath,
  clientVersion,
  engineVersion,
}: CommonCodeParams): string => `
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  warnEnvConflicts,
  getPrismaClient,
  sqltag as sql,
  empty,
  join,
  raw,
  Sql,
  Decimal,
} from '${runtimePath}/esm'
import path from 'path'
import { fileURLToPath } from 'url';
const debug = debugLib('prisma-client')
/**
 * Polyfill __dirname for esm modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Prisma Client JS version: ${clientVersion}
 * Query Engine version: ${engineVersion}
 */
export const prismaVersion = {
  client: "${clientVersion}",
  engine: "${engineVersion}"
}
export { PrismaClientKnownRequestError }
export { PrismaClientUnknownRequestError }
export { PrismaClientRustPanicError }
export { PrismaClientInitializationError }
export { PrismaClientValidationError }
export { Decimal }
/**
 * Re-export of sql-template-tag
 */
export { sql, empty, join, raw, Sql }
`
