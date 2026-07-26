/**
 * Tracks the most recent of a sequence of in-flight async requests so a
 * response that resolves out of order can be told apart from the current one.
 * Call `next()` when starting a request, keep the returned token, and check
 * `isCurrent(token)` when the response arrives — a stale token means a newer
 * request has since started and this response should be dropped.
 */
export function createRequestGuard() {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (token: number) => token === current,
  };
}
