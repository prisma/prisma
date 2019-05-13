## Prisma demo package

### Setup
1. `./setup.sh`
2. `./prisma`
3. Open the Playground at `127.0.0.1:4466/`
4. Playground will most likely not work. Harass Tim to make it work.
5. To update simply run the setup script again.

### Notes
- Default OS and release channel is `darwin` and `alpha`, respectively. To change that, you can set `OS` and `CHANNEL` env vars before running the setup script (`OS=... CHANNEL=... ./setup.sh`).
- Valid `OS` values are: `darwin`, `linux-musl`, `linux-glibc`.
- Valid `CHANNEL` values are (for now): `alpha`, `beta`.