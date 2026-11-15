/**
 * Sliding-window limit per key (client IP, API key, ...), in memory.
 * One container serves everything, so no shared store is needed.
 *
 * Calling the limiter records a hit and reports whether the key is over the
 * limit: the first `limit` hits in a window are allowed, the rest are refused.
 * Refused hits are not recorded, so a key never holds more than `limit`
 * timestamps (memory is capped per key) and the key is allowed again once its
 * oldest recorded hit leaves the window.
 *
 * `limiter.isLimited(key)` checks the same condition without recording a hit,
 * for callers that only count some outcomes (e.g. failed authentications).
 */
const createRateLimiter = (limit, windowMs) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(key);
    }
  }, windowMs).unref();

  const recentHits = (key, now) => {
    const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
    return recent;
  };

  const limiter = (key) => {
    const now = Date.now();
    const recent = recentHits(key, now);
    if (recent.length >= limit) return true;
    recent.push(now);
    hits.set(key, recent);
    return false;
  };
  limiter.isLimited = (key) => recentHits(key, Date.now()).length >= limit;
  /** Number of timestamps held for a key (for tests). */
  limiter.size = (key) => hits.get(key)?.length ?? 0;
  return limiter;
};

module.exports = { createRateLimiter };
