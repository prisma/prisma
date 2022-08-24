import { isCi as isCiLib } from 'is-ci'

export const isCi = (): boolean => {
  return !process.stdin.isTTY || isCiLib || Boolean(process.env.GITHUB_ACTIONS)
}
