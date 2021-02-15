import chalk from 'chalk'

export const tags = {
  error: chalk.red('error(prisma)'),
  warn: chalk.yellow('warn(prisma)'),
  info: chalk.blue('info(prisma)'),
}
export const should = {
  warn: !process.env.PRISMA_DISABLE_WARNINGS,
}
export function log(...data: any[]) {
  console.log(...data)
}
export function warn(message: any, ...optionalParams: any[]) {
  if (should.warn) {
    console.warn(`${tags.warn} ${message}`, ...optionalParams)
  }
}
export function info(message: any, ...optionalParams: any[]) {
  console.info(`${tags.info} ${message}`, ...optionalParams)
}
export function error(message: any, ...optionalParams: any[]) {
  console.error(`${tags.error} ${message}`, ...optionalParams)
}
