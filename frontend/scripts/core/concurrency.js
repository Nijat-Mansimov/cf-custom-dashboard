/**
 * Concurrency Utilities
 * Limits parallel async tasks (e.g. fetching zone analytics concurrently).
 */

/**
 * Execute an array of items through an async mapper with a concurrency limit
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @param {number} [limit=6]
 * @returns {Promise<PromiseSettledResult<R>[]>}
 */
export async function mapConcurrentSettled(items, mapper, limit = 6) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      const item = items[idx];
      try {
        const val = await mapper(item, idx);
        results[idx] = { status: 'fulfilled', value: val };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}
