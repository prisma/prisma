process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'

globalThis.testIf = (condition: boolean) => (condition ? test : test.skip)
globalThis.describeIf = (condition: boolean) => (condition ? describe : describe.skip)

export {}
