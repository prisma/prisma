export interface CommonCodeParams {
  runtimePath: string
  clientVersion: string
  engineVersion: string
}

export const commonCodeJS = ({
  runtimePath,
  clientVersion,
  engineVersion,
}: CommonCodeParams): string => `
Object.defineProperty(exports, "__esModule", { value: true });

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

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError;
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError;
Prisma.PrismaClientInitializationError = PrismaClientInitializationError;
Prisma.PrismaClientValidationError = PrismaClientValidationError;
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */

Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
`

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
export type PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
export type PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
export type PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
export type PrismaClientInitializationError = runtime.PrismaClientInitializationError
export type PrismaClientValidationError = runtime.PrismaClientValidationError

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

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * XOR is needed to have a real mutually exclusive union type
 * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
 */
type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

${!hideFetcher ? (
      `class PrismaClientFetcher {
  private readonly prisma;
  private readonly debug;
  private readonly hooks?;
  constructor(prisma: PrismaClient<any, any>, debug?: boolean, hooks?: Hooks | undefined);
  request<T>(document: any, dataPath?: string[], rootField?: string, typeName?: string, isList?: boolean, callsite?: string): Promise<T>;
  sanitizeMessage(message: string): string;
  protected unpack(document: any, data: any, path: string[], rootField?: string, isList?: boolean): any;
}`) : ''
    }
`})
