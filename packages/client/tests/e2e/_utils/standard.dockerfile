FROM node:16

RUN npm i -g pnpm zx typescript jest ts-node esbuild esbuild-register @swc/jest
CMD chmod +x ./ecosystem/_utils/standard.cmd.sh && ./ecosystem/_utils/standard.cmd.sh
