/**
 * Compute a stable hash of any value. If the value carries its own `hash()`
 * method (the Arel-node convention) we delegate; otherwise we string-encode
 * and run a deterministic 32-bit FNV-1a. Arrays hash element-wise.
 *
 * Hashes are used internally as cache keys (e.g. in Predications.eq); they
 * are never persisted, so any deterministic algorithm works. FNV-1a is used
 * instead of `Bun.hash` so the compiled package runs in any ESM runtime.
 */
export const hash = (value: unknown): number => {
  if (
    value &&
    typeof value === 'object' &&
    'hash' in value &&
    typeof (value as { hash: unknown }).hash === 'function'
  ) {
    return (value as { hash: () => number }).hash();
  }

  let str = '';
  if (Array.isArray(value)) {
    str = `[${value.map((x) => hash(x)).join(',')}]`;
  } else {
    str = String(value);
  }
  if (str.length === 0) return 0;

  return fnv1a32(str);
};

const fnv1a32 = (str: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};
