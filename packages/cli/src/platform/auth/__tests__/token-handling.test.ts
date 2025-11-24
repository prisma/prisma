import { defaultTestConfig } from '@prisma/config'

import { ErrorPlatformTokenExpired } from '../../_'
import { credentialsFile } from '../../_lib/credentials'
import { Show } from '../show'

test('detects expired token and deletes credentials file', async () => {
  const expiredToken =
    'eyJraWQiOiJUa0hEN1ltOUNaQ2xESHYwazEyTEFhWjk4NTdGOE16dWxYTXJBMFpqbWVrIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJzenhnNDBldnIybDlpNXV3cnB4eHJneXYiLCJqdGkiOiJmdmYyZWJ2dTYzdml6NDd4NjhhNWhlbnQiLCJpYXQiOjE3NDczMjQ0NjM2NjgsImV4cCI6MTc1NTEwMDQ2MzY2OH0.aqOKA121IsDu1vvVE7yfGaLE3lfazc8jk87IFE8ykyM24Gzehh6QPGG90XwavCm0lheNiGf2faYrMPBax7bhpx0l0lkucbXpRPY1Uo4Tc2lGkESy6w6fnSr8_1lmEJ7J6g3KIqMAyRtTnW5mBCvmhqEEDUY5oXKUUQLKVsYBaCDvmOzc7nzeqWyRnr9SPOBqZVuLYHwRCWcZzqSJBzNtXhgZfEByH169NMjk-j77OYCW7KpxW7HrFbaf7Q9vXFvM8MG9W9uIbHgQy83K2IYJG3zlwONYulcV1-L3E5KNv7RuuLgPKHMFBkDlOjH6H0HFwsu46kzdthPihiWigqkS_g'
  await credentialsFile.save({ token: expiredToken })

  await expect(Show.new().parse([], defaultTestConfig())).rejects.toEqual(ErrorPlatformTokenExpired)
  const credentials = await credentialsFile.load()
  expect(credentials).toBeNull()
})
