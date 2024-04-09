// matches `/snapshot/` or `C:\\snapshot\\` or `C:/snapshot/` for vercel's pkg apps
export const vercelPkgPathRegex = /^((\w:[\\\/])|\/)snapshot[\/\\]/
