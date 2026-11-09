export function createRevocableStore(StoreClass, store, {
  revocationTtlMs,
  cleanupIntervalMs = 60_000,
  now = Date.now,
} = {}) {
  if (!Number.isFinite(revocationTtlMs) || revocationTtlMs < 1) throw new Error('Invalid session revocation lifetime.');
  if (!Number.isFinite(cleanupIntervalMs) || cleanupIntervalMs < 1) throw new Error('Invalid session cleanup interval.');

  class RevocableStore extends StoreClass {
    constructor() {
      super();
      this.delegate = store;
      this.queues = new Map();
      this.revoked = new Map();
      this.leases = new Map();
      this.closed = false;
      this.reaper = setInterval(() => this.cleanup(), cleanupIntervalMs);
      this.reaper.unref?.();
    }

    cleanup() {
      const time = now();
      for (const [sid, tombstone] of this.revoked) {
        if (tombstone.expiresAt <= time && !this.leases.has(sid) && !this.queues.has(sid)) this.revoked.delete(sid);
      }
    }

    isRevoked(sid) {
      const tombstone = this.revoked.get(sid);
      if (!tombstone) return false;
      if (tombstone.expiresAt > now() || this.leases.has(sid) || this.queues.has(sid)) return true;
      this.revoked.delete(sid);
      return false;
    }

    trackRequest(sid) {
      if (typeof sid !== 'string' || !sid) return () => {};
      this.leases.set(sid, (this.leases.get(sid) || 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const count = this.leases.get(sid) || 0;
        if (count <= 1) this.leases.delete(sid);
        else this.leases.set(sid, count - 1);
        this.cleanup();
      };
    }

    enqueue(sid, operation, callback) {
      const previous = this.queues.get(sid) || Promise.resolve();
      const current = previous.then(operation, operation);
      this.queues.set(sid, current);
      current.then(
        (value) => this.deliver(callback, null, value),
        (error) => this.deliver(callback, error),
      ).finally(() => {
        if (this.queues.get(sid) === current) this.queues.delete(sid);
        this.cleanup();
      });
      return current;
    }

    deliver(callback, error, value) {
      if (!callback) return;
      try { callback(error, value); }
      catch (callbackError) { process.nextTick(() => { throw callbackError; }); }
    }

    invoke(method, ...args) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const callback = (error, value) => {
          if (settled) return;
          settled = true;
          error ? reject(error) : resolve(value);
        };
        try {
          const result = this.delegate[method](...args, callback);
          if (result && typeof result.then === 'function') result.then((value) => callback(null, value), callback);
        } catch (error) { callback(error); }
      });
    }

    get(sid, callback) {
      if (this.isRevoked(sid)) return queueMicrotask(() => this.deliver(callback, null, null));
      this.enqueue(sid, () => this.invoke('get', sid), callback);
    }

    set(sid, session, callback) {
      if (this.isRevoked(sid)) return queueMicrotask(() => this.deliver(callback, null));
      this.enqueue(sid, () => this.invoke('set', sid, session), callback);
    }

    touch(sid, session, callback) {
      if (this.isRevoked(sid)) return queueMicrotask(() => this.deliver(callback, null));
      const method = typeof this.delegate.touch === 'function' ? 'touch' : 'set';
      this.enqueue(sid, () => this.invoke(method, sid, session), callback);
    }

    destroy(sid, callback) {
      const expiresAt = now() + revocationTtlMs;
      const previous = this.revoked.get(sid);
      this.revoked.set(sid, { expiresAt: Math.max(previous?.expiresAt || 0, expiresAt) });
      this.enqueue(sid, () => this.invoke('destroy', sid), (error, value) => {
        this.revoked.set(sid, { expiresAt: now() + revocationTtlMs });
        this.deliver(callback, error, value);
        this.cleanup();
      });
    }

    all(callback) {
      if (typeof this.delegate.all !== 'function') return this.deliver(callback, new Error('Session store does not support all.'));
      return this.delegate.all(callback);
    }

    length(callback) {
      if (typeof this.delegate.length !== 'function') return this.deliver(callback, new Error('Session store does not support length.'));
      return this.delegate.length(callback);
    }

    clear(callback) {
      if (typeof this.delegate.clear !== 'function') return this.deliver(callback, new Error('Session store does not support clear.'));
      return this.delegate.clear(callback);
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      clearInterval(this.reaper);
      this.cleanup();
    }
  }

  return new RevocableStore();
}
