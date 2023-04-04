import { checkPlatformCaching } from './checkPlatformCaching'

test('generated via postinstall on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Vercel', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    We have detected that you've built your project on Vercel, which caches dependencies.
    This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered.
    To fix this, make sure to run the \`prisma generate\` command during your build process.
    Learn how: https://pris.ly/d/vercel-build
  `)
})

test('generated on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Vercel', clientVersion: '0.0.0' })).not.toThrow()
})

test('generated via postinstall on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    We have detected that you've built your project on Netlify CI, which caches dependencies.
    This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered.
    To fix this, make sure to run the \`prisma generate\` command during your build process.
    Learn how: https://pris.ly/d/netlify-build
  `)
})

test('generated on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Netlify CI', clientVersion: '0.0.0' })).not.toThrow()
})

export {}
