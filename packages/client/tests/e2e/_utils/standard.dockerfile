FROM node:16 as base

FROM base as dependencies
RUN npm i -g pnpm zx typescript jest ts-node esbuild esbuild-register @swc/jest

FROM dependencies as run
CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
