export class TransitCache {
  constructor({ maxEntries = 250, ttlMs = 15 * 60 * 1000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }

    return value;
  }

  clear() {
    this.entries.clear();
  }
}

export const transitCache = new TransitCache();

