import { Scheduler } from './Scheduler'

describe('Scheduler', () => {
  it('should be ordered', async () => {
    const scheduler = new Scheduler()

    const taskIds = [
      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(1), 10)
          }),
      ),

      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(2), 1)
          }),
      ),

      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(3), 100)
          }),
      ),

      scheduler.queue(() => 4),

      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(5), 25)
          }),
      ),

      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(6), 25)
          }),
      ),

      scheduler.queue(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(7), 3)
          }),
      ),
    ].reverse() // we should be able to await in any order

    const taskPromises = taskIds.map((id) => scheduler.wait(id))
    const taskResults = await Promise.all(taskPromises)

    expect(taskResults).toStrictEqual([7, 6, 5, 4, 3, 2, 1])
  })
})
