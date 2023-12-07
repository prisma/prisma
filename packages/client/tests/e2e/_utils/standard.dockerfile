FROM node:18 as base

FROM base as dependencies
RUN npm i -g pnpm zx typescript jest ts-node esbuild esbuild-register @swc/jest
RUN apt update
RUN apt install iproute2 -y

FROM dependencies as run
CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
