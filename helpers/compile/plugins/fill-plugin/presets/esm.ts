import path from 'path'

import { Fillers } from '../fillPlugin'

export const esmPreset: Fillers = {
  $: {
    import: [`import { createRequire } from "module"`, `const require = createRequire(import.meta.url)`],
  },
  __dirname: {
    inject: path.join(__dirname, 'esm', 'dirname.ts'),
  },
  __filename: {
    inject: path.join(__dirname, 'esm', 'filename.ts'),
  },
}
