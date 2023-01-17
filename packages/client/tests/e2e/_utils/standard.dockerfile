FROM node:16

RUN npm i -g pnpm zx typescript jest ts-node esbuild esbuild-register @swc/jest
CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
