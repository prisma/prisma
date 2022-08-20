import fs from 'fs'
import path from 'path'

describe('runtime/index.d.ts', () => {
  it("does not depend on 'node' types", () => {
    const runtimeDtsPath = path.join(__dirname, '..', '..', 'runtime', 'index.d.ts')
    const runtimeDts = fs.readFileSync(runtimeDtsPath).toString()
    expect(runtimeDts).not.toContain('/// <reference types="node" />')
  })
})
