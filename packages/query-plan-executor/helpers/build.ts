import fs from 'node:fs/promises'
import path from 'node:path'

import { build } from '../../../helpers/compile/build'
import { adapterConfig } from '../../../helpers/compile/configs'

void build(adapterConfig).then(() => fs.rm(path.join(__dirname, '..', 'dist', 'src'), { recursive: true, force: true }))
