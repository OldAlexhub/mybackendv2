class ResilientCache {
  constructor() {
    this.values = new Map();
    this.pending = new Map();
  }

  async remember(key, ttl, loader) {
    const now = Date.now();
    const current = this.values.get(key);

    if (current && current.expiresAt > now) {
      return { value: current.value, cachedAt: current.cachedAt, stale: false };
    }

    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const request = (async () => {
      try {
        const value = await loader();
        const cachedAt = new Date().toISOString();
        this.values.set(key, { value, cachedAt, expiresAt: Date.now() + ttl });
        return { value, cachedAt, stale: false };
      } catch (error) {
        if (current) {
          return {
            value: current.value,
            cachedAt: current.cachedAt,
            stale: true,
            refreshError: error.message,
          };
        }
        throw error;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, request);
    return request;
  }

  clear() {
    this.values.clear();
    this.pending.clear();
  }
}

export const ntdCache = new ResilientCache();

