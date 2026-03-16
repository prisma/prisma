FROM node:20.19

RUN npm -v

# zx is pinned to v7 because v8 fails with: 
# [esbuild Error]: Top-level await is currently not supported with the "cjs" output format
# at /usr/local/lib/node_modules/zx/build/vendor.js:2:17
RUN npm i -g \
  zx@7 \
  pnpm \
  typescript \
  ts-node \
  esbuild \
  tsx \
  jest \
  @swc/jest@0.2.32

RUN apt update && \
  apt install iproute2 jq -y

# install Bun runtime
# Set BUN_INSTALL explicitly and add to PATH
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# install Bun (respecting the BUN_INSTALL env var), and verify it's installed and accessible
RUN curl -fsSL https://bun.sh/install | bash && \
  ls -la ${BUN_INSTALL}/bin/bun && \
  bun --version

CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
