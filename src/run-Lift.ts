import { Lift } from './Lift'
import path from 'path'

async function main() {
  const lift = new Lift(path.resolve(__dirname, '../examples/blog/'))
  await lift.run()
}

main().catch(console.error)
