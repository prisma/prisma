export async function time<R>(title: string, fn: () => Promise<R>): Promise<R> {
  const timeStart = Date.now()

  const result = await fn()

  const timeEnd = Date.now()
  console.log(`${title}:`)
  console.log(timeEnd - timeStart)

  return result
}
