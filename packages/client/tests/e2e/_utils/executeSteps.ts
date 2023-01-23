export async function executeSteps(steps: {
  setup: () => Promise<void>
  test: () => Promise<void>
  finish: () => Promise<void>
  keep?: boolean
}) {
  try {
    await steps.setup()
    await steps.test()
  } finally {
    await steps.finish()

    while (steps.keep === true) {
      await new Promise((res) => {
        setTimeout(res, 10000)
      })
    }
  }
}
