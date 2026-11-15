/**
 * Sliding-window limit per key (client IP, API key, ...), in memory.
 * One container serves everything, so no shared store is needed.
 * Returns a function that records a hit and reports whether the key is over the limit.
 */
const createRateLimiter = (limit, windowMs) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(key);
    }
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > limit;
  };
};

module.exports = { createRateLimiter };
