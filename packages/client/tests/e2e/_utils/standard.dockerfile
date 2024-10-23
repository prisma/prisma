FROM node:18.20.4 as base

FROM base as dependencies

RUN node -v
RUN npm -v

# zx is pinned to v7 because v8 fails with: 
# [esbuild Error]: Top-level await is currently not supported with the "cjs" output format
# at /usr/local/lib/node_modules/zx/build/vendor.js:2:17
RUN npm i -g zx@7 

RUN npm i -g pnpm
RUN npm i -g typescript 
RUN npm i -g ts-node 
RUN npm i -g esbuild tsx
RUN npm i -g jest 
RUN npm i -g @swc/jest@0.2.32

RUN apt update
RUN apt install iproute2 -y

FROM dependencies as run
CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
