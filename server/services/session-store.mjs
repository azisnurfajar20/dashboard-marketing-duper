import session from 'express-session';

// FileStore touch is a read/modify/write, while destroy is an independent
// unlink. Serialize their entire callbacks, not just the start of each write.
export class RevocableSessionStore extends session.Store {
  #store;
  #queues = new Map();
  #revoked = new Map();
  #ttlMs;

  constructor(store, { ttlMs }) {
    super();
    this.#store = store;
    this.#ttlMs = ttlMs;
    // Keep express-session's capability detection unchanged for injected stores.
    this.touch = typeof store.touch === 'function'
      ? (sid, value, callback) => this.#write('touch', sid, value, callback)
      : undefined;
    store.on('connect', () => this.emit('connect'));
    store.on('disconnect', () => this.emit('disconnect'));
  }

  get(sid, callback) {
    const revoked = this.#revoked.has(sid);
    this.#enqueue(sid, (done) => {
      if (revoked || this.#revoked.has(sid)) return done(null, null);
      this.#store.get(sid, (...args) => {
        // A read already in progress must not hand out auth after revocation.
        done(...(this.#revoked.has(sid) ? [null, null] : args));
      });
    }, callback);
  }

  set(sid, value, callback) {
    this.#write('set', sid, value, callback);
  }

  destroy(sid, callback) {
    const previous = this.#revoked.get(sid);
    if (previous?.timer) clearTimeout(previous.timer);
    const revocation = {};
    // Revoke immediately, including while older I/O is still draining.
    this.#revoked.set(sid, revocation);
    this.#enqueue(sid, (done) => this.#store.destroy(sid, done), (...args) => {
      if (this.#revoked.get(sid) === revocation) {
        // Start the retention window after unlink settles so slow older writes
        // cannot outlive it. No timer keeps the process alive.
        revocation.timer = setTimeout(() => this.#revoked.delete(sid), this.#ttlMs);
        revocation.timer.unref();
      }
      callback?.(...args);
    });
  }

  #write(method, sid, value, callback) {
    const revoked = this.#revoked.has(sid);
    this.#enqueue(sid, (done) => {
      if (revoked || this.#revoked.has(sid)) return done(null);
      this.#store[method](sid, value, done);
    }, callback);
  }

  #enqueue(sid, operation, callback) {
    let queue = this.#queues.get(sid);
    if (!queue) {
      queue = [];
      this.#queues.set(sid, queue);
    }
    queue.push({ operation, callback });
    if (queue.length === 1) this.#run(sid, queue);
  }

  #run(sid, queue) {
    const { operation, callback } = queue[0];
    let finished = false;
    const done = (...args) => {
      if (finished) return;
      finished = true;
      // Also support synchronous injected stores without recursive queue drain
      // or interpreting a caller's thrown callback as an underlying I/O error.
      queueMicrotask(() => {
        try {
          callback?.(...args);
        } finally {
          queue.shift();
          if (queue.length) this.#run(sid, queue);
          else this.#queues.delete(sid);
        }
      });
    };
    try {
      operation(done);
    } catch (error) {
      done(error);
    }
  }
}
