/**
 * Replace unstable time values (duration and timestamp) if their types are correct.
 *
 * @param fn Jest mock function passed as the log callback.
 */
export function replaceTimeValues(fn: jest.Mock) {
  for (const [event] of fn.mock.calls) {
    if (typeof event.duration === 'number') {
      event.duration = 0
    }

    // Only replace valid dates. Dates with valueOf() equal to NaN should fail the snapshots.
    if (event.timestamp instanceof Date && !Number.isNaN(event.timestamp.valueOf())) {
      event.timestamp = new Date(0)
    }
  }
}
