import 'ts-node/register'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it.skip('should work with a custom output dir', async () => {
  ctx.fixture('example-project')
  const data = await ctx.cli('generate')

  if (typeof data.signal === 'number' && data.signal !== 0) {
    throw new Error(data.stderr + data.stdout)
  }

  const { main } = await import(ctx.fs.path('main.ts'))
  expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  await expect(main()).resolves.toMatchSnapshot()
}, 10000)

it.skip('should error with exit code 1 with incorrect schema', async () => {
  ctx.fixture('broken-example-project')
  await expect(ctx.cli('generate').catch((e) => e.exitCode)).resolves.toEqual(1)
})

function cleanSnapshot(str: string): string {
  return str
    .replace(/\d+ms/g, 'XXms')
    .replace(/\(version:.+\)/g, '(version: 0.0.0)')
}
