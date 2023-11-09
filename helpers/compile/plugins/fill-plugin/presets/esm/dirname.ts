import path from 'path'

import { fileUrlToPath } from './fileUrlToPath'

// @ts-ignore
export const __dirname = path.dirname(fileUrlToPath(import.meta.url))

