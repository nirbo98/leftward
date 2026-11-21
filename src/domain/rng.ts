/** Mulberry32 — tiny deterministic PRNG so stimulus layouts are reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  return items[Math.floor(rand() * items.length) % items.length] as T;
}

/** Local, non-cryptographic unique id. Never derived from personal data. */
export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return prefix + c.randomUUID();
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
