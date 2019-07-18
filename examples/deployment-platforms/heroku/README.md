### Notes

1. They `prune` devDeps after post install and `@generated` is removed, hence, we move `Photon` out of `node_modules`.
2. We still keep the post install hook though, to auto swap the binary.
3. Binary detection needs some love.
