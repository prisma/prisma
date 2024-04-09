import { yellow } from 'kleur/colors'

export function printConfigWarnings(warnings: string[]) {
  if (warnings && warnings.length > 0) {
    const message = warnings.map((warning) => `${yellow('warn')} ${warning}`).join('\n')
    console.warn(message)
  }
}
