FROM node:20 as base

FROM base as dependencies

RUN node -v
RUN npm -v

RUN npm i -g zx 
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
