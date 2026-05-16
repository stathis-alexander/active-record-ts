import { hash as bunHash } from 'bun';

/**
 * Compute a stable hash of any value. If the value carries its own `hash()`
 * method (the Arel-node convention) we delegate; otherwise we string-encode
 * and run Bun's native hash. Arrays hash element-wise.
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

  return Number(bunHash(str));
};
