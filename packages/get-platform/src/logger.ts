import chalk from 'chalk'

export const tags = {
  warn: chalk.yellow('prisma:warn'),
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
