const Sequencer = require('@jest/test-sequencer').default

class CustomSequencer extends Sequencer {
  /**
   * Sort order of execution for test suites
   */
  sort(tests) {
    const copyTests = Array.from(tests)

    const sorted = copyTests.sort((testA, testB) => {
      if (testA.path.includes('typescript')) return -1
      if (testB.path.includes('typescript')) return -1

      return testA.path > testB.path ? -1 : 1
    })

    return sorted
  }
}

module.exports = CustomSequencer
