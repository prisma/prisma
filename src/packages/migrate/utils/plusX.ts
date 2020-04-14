import fs from 'fs'

export default function plusX(file: fs.PathLike): void {
  if (fs.existsSync(file)) {
    const s = fs.statSync(file)
    const newMode = s.mode | 64 | 8 | 1
    if (s.mode === newMode) return
    const base8 = newMode.toString(8).slice(-3)
    fs.chmodSync(file, base8)
  }
}
