import resolvePkg from 'resolve-pkg'

const pkg = resolvePkg('@prisma/client', { cwd: __dirname })
console.log({ pkg })
