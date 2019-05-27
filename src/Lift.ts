import { LiftEngine } from './LiftEngine'

export class Lift {
  engine: LiftEngine
  constructor(projectDir: string) {
    this.engine = new LiftEngine({ projectDir })
  }
  async run() {
    const migrations = await this.engine.listMigrations()
    console.log(migrations)
  }
}
