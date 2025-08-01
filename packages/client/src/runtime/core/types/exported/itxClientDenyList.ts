const denylist = ['$connect', '$disconnect', '$on', '$transaction', '$extends'] as const

export const itxClientDenyList = denylist as ReadonlyArray<string | symbol>

export type ITXClientDenyList = (typeof denylist)[number]
