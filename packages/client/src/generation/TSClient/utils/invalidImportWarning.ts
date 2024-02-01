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
  '3. If you have a `tsconfig.json`, you will need to set `module` and `moduleResolution`.',
  'Set `moduleResolution` to `nodenext` or `bundler`, and set `module` to `nodenext`.',
  '',
  '-----',
  '4. Update your imports, once done, your client will be properly set up.',
  '```',
  'import { PrismaClient } from "db"',
  '```',
  '-----',
  'More information: https://pris.ly/d/custom-output',
]

export const invalidImportWarningJs = invalidImportWarningTs.map((line) => line.replace('-----', '\\n'))
