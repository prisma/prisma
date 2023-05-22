import { bgRed, bold, red } from 'kleur/colors'

export function printError(text): string {
  return bold(bgRed(' ERROR ')) + ' ' + red(text)
}
