import { hash as bunHash } from 'bun';

export const hash = (value: any) => {
  if (value && typeof value === 'object' && 'hash' in value && typeof value.hash === 'function') {
    return value.hash();
  }

  let str: string = '';
  if (Array.isArray(value)) {
    str = `[${value.map((x) => hash(x)).join(',')}]`;
  } else {
    str = String(value);
  }
  if (str.length === 0) return 0;

  return bunHash(str);
};
