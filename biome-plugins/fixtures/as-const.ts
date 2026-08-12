// Fixture (b): `as const` only — no-bare-cast must NOT fire.

export const directions = ['north', 'south', 'east', 'west'] as const;

export const config = { retries: 3, timeout: 5000 } as const;
