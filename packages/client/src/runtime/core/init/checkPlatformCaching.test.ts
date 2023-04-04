import { checkPlatformCaching } from './checkPlatformCaching'

test('generated via postinstall on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Vercel', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    We detected that your project setup might lead to outdated Prisma Client being used.
    Please make sure to run the \`prisma generate\` command during your build process.
    Learn how: https://pris.ly/d/vercel-build
  `)
})

test('generated on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Vercel', clientVersion: '0.0.0' })).not.toThrow()
})

test('generated via postinstall on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    We detected that your project setup might lead to outdated Prisma Client being used.
    Please make sure to run the \`prisma generate\` command during your build process.
    Learn how: https://pris.ly/d/netlify-build
  `)
})

test('generated on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Netlify CI', clientVersion: '0.0.0' })).not.toThrow()
})

export {}
