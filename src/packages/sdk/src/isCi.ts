import { isCi as isCiLib } from 'is-ci'

export const isCi: boolean =
  !process.stdout.isTTY || isCiLib || process.env.GITHUB_ACTIONS
