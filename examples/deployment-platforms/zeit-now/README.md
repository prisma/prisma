### Setup

1. Install now: `curl -sfLS https://zeit.co/download.sh | sh`
1. Development `now dev` (Note in `index.js`) the hack to get correct binary.
   That is required because

- `prisma2 generate` doesn't support zeit right now i.e. we can't rely on `postinstall generate` hook. Zeit doesn't move `node_modules` but uses `package.json` as source of truth. This means that we need to print photon outside of `node_modules` and check it in right now.

1. Had to increase the lambdaSize to "25mb" but now detects this at build time which is awesome.
1. Local development experience, 1st request is slow, rest are fast.
1. Production deploy same as local deploy:

- https://express-photon.divyenduz1.now.sh/
- Deployed using `now -e DEBUG=true -e BINARY_NAME=prisma-zeit`
