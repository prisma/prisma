import jestSnapshot from 'jest-snapshot'
import expectAny from 'expect'
const expect: any = expectAny

expect.extend({ toMatchSnapshot })
export { expect }

export function toMatchSnapshot(this: any, content, mochaContext, name) {
  if (!mochaContext || !mochaContext.test) {
    throw new Error(
      'Missing `mochaContext` argument for .toMatchSnapshot().\n' +
        'Did you forget to pass `this` into expect().toMatchSnapshot(this)?',
    )
  }

  const { test } = mochaContext

  const snapshotState = new jestSnapshot.SnapshotState(test.file, {
    updateSnapshot: process.env.SNAPSHOT_UPDATE ? 'all' : 'new',
    getBabelTraverse: () => require('@babel/traverse').default,
    getPrettier: () => require('prettier'),
  })

  const matcher = jestSnapshot.toMatchSnapshot.bind({
    snapshotState,
    currentTestName: makeTestTitle(test),
  } as any)

  const result = matcher(content, name)
  snapshotState.save()

  return result
}

function makeTestTitle(test: any) {
  let next: any = test
  const title: any[] = []

  for (;;) {
    if (!next.parent) {
      break
    }

    title.push(next.title)
    next = next.parent
  }

  return title.reverse().join(' ')
}
