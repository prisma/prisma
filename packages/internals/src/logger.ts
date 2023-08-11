import { blue, cyan, red, yellow } from 'kleur/colors'

export const tags = {
  error: red('prisma:error'),
  warn: yellow('prisma:warn'),
  info: cyan('prisma:info'),
  query: blue('prisma:query'),
}
export const should = {
  warn: () => !process.env.PRISMA_DISABLE_WARNINGS,
}
export function log(...data: any[]) {
  console.log(...data)
}
export function warn(message: any, ...optionalParams: any[]) {
  if (should.warn()) {
    console.warn(`${tags.warn} ${message}`, ...optionalParams)
  }
}
export function info(message: any, ...optionalParams: any[]) {
  console.info(`${tags.info} ${message}`, ...optionalParams)
}
export function error(message: any, ...optionalParams: any[]) {
  console.error(`${tags.error} ${message}`, ...optionalParams)
}
export function query(message: any, ...optionalParams: any[]) {
  console.log(`${tags.query} ${message}`, ...optionalParams)
}
