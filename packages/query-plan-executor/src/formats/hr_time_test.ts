import { assertEquals } from '@std/assert'
import { instantToHrTime } from './hr_time.ts'

Deno.test('instantToHrTime - converts instant to HrTime array', () => {
  const instant = Temporal.Instant.from('2023-05-20T12:34:56.789123456Z')
  const hrTime = instantToHrTime(instant)

  // 2023-05-20T12:34:56Z seconds since epoch
  assertEquals(hrTime[0], 1684586096)
  // The nanosecond portion (789123456)
  assertEquals(hrTime[1], 789123456)
})

Deno.test('instantToHrTime - handles zero nanoseconds correctly', () => {
  const instant = Temporal.Instant.from('2023-05-20T12:34:56Z')
  const hrTime = instantToHrTime(instant)

  assertEquals(hrTime[0], 1684586096)
  assertEquals(hrTime[1], 0)
})
