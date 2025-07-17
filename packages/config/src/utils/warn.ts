import { yellow } from 'kleur/colors'

export const tags = {
  warn: yellow('prisma:warn'),
}
export const should = {
  warn: () => !process.env.PRISMA_DISABLE_WARNINGS,
}
export function warn(message: any, ...optionalParams: any[]) {
  if (should.warn()) {
    console.warn(`${tags.warn} ${message}`, ...optionalParams)
  }
}
