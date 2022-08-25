// Same logic as https://github.com/sindresorhus/is-interactive/blob/dc8037ae1a61d828cfb42761c345404055b1e036/index.js
// But defaults to check `stdin` for our prompts
// It checks that the stream is TTY, not a dumb terminal
export const isInteractive = ({ stream = process.stdin } = {}): boolean => {
  return Boolean(stream && stream.isTTY && process.env.TERM !== 'dumb')
}
