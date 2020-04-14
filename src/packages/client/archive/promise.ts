async function get(): Promise<{ id: string } | null> {
  return { id: '' }
}

async function run() {
  const result = await get()
}
