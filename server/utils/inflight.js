const inflight = new Map();

async function dedupe(key, factory) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = (async () => {
    try {
      return await factory();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

module.exports = { dedupe };
