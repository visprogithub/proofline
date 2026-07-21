/**
 * Runs items through a handler with a bounded number of concurrent workers.
 *
 * Shared by both advisory lanes so concurrency and queue policy cannot drift between
 * them. The handler owns its own bookkeeping; this only governs how many run at once.
 */
export async function runBounded<T>(
  items: readonly T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      // No await separates the read from the increment, so two workers can never claim
      // the same item on JavaScript's single-threaded loop. The guard satisfies
      // noUncheckedIndexedAccess rather than any real runtime case.
      if (item === undefined) continue
      await handler(item)
    }
  }

  await Promise.all(Array.from(
    { length: Math.max(0, Math.min(concurrency, items.length)) },
    () => worker(),
  ))
}
