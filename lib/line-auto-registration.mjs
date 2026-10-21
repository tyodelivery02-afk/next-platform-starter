// One queue per ON interval. No automatic reattempt after a submission failure.
export function createAutoRegistrationQueue(register, enabled) {
  const seen = new Set();
  const pending = [];
  let running = false;
  let stopped = false;
  async function drain() {
    if (running || stopped) return;
    running = true;
    try {
      while (!stopped && enabled() && pending.length) {
        const code = pending.shift();
        try {
          // A manual submission may already own this code; allow a later poll to check again.
          if (await register(code) === false) seen.delete(code);
        } catch { /* Keep attempted codes marked; the page exposes the registration error. */ }
      }
    } finally { running = false; }
  }
  return {
    add(items) {
      if (stopped || !enabled()) return;
      for (const item of items) {
        if (!/^E[A-Z0-9]{11}$/.test(item.code) || seen.has(item.code) || ['registered','processing','unknown'].includes(item.registration_state)) continue;
        seen.add(item.code);
        pending.push(item.code);
      }
      return drain();
    },
    stop() { stopped = true; pending.length = 0; },
  };
}
