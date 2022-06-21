import { isCi as isCiLib } from 'is-ci'

export const isCi = (): boolean => {
  return !process.stdout.isTTY || isCiLib || Boolean(process.env.GITHUB_ACTIONS)
}
