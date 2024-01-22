export const invalidImportWarningTs = [
  'You are importing your Prisma Client from the wrong path, please follow these steps:',
  '-----',
  '1. At the root of this project (or package), get the relative path to your client.',
  'For example, that could be `../prisma/client` or `./client` or something similar.',
  '-----',
  '2. Once you know where your client is located, add your own client as a dependency.',
  ' - For npm, run `npm add db@./path/to/your/client`',
  ' - For pnpm, run `pnpm add db@link:./path/to/your/client`',
  ' - For yarn, run `yarn add db@link:./path/to/your/client`',
  '-----',
  '3. If you have a `tsconfig.json`, set `moduleResolution` to `node16`, `nodenext`, or `bundler`.',
  'Alternatively, if you prefer, setting `module` to `node16` or `nodenext` equally works.',
  '-----',
  '4. Your client is now properly setup. To suppress this warning, update your imports.',
  '```',
  'import { PrismaClient } from "db"',
  '```',
  '-----',
  'More information: https://pris.ly/d/custom-output',
]

export const invalidImportWarningJs = invalidImportWarningTs.map((line) => line.replace('-----', '\n'))
