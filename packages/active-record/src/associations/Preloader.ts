/**
 * Preloader — batches association loads to avoid N+1 queries.
 *
 *   const posts = await Post.includes('user', 'comments');
 *   // Behind the scenes, after the Post query:
 *   //   SELECT * FROM users     WHERE id IN (?, ?, ?, ...)
 *   //   SELECT * FROM comments  WHERE post_id IN (?, ?, ?, ...)
 *   posts.forEach(p => p.user);        // already in cache, no extra query
 *   posts.forEach(p => p.comments);    // chained Relation backed by cached data
 *
 * The Preloader walks one association name at a time, consults the
 * declared reflection, runs a single batched query keyed on the FK / PK
 * pair, and writes the result onto each owner via `setCachedAssociation`.
 *
 * Polymorphic belongs_to splits the owners by `${name}_type`, runs one
 * query per concrete target class, then stitches results back.
 */

import type { Base, BaseConstructor } from '../Base';
import { setCachedAssociation } from './accessors';
import { lookupAssociation } from './registry';
import type { AssociationReflection } from './types';

/**
 * Preload `name` (and any deeper paths separated by `.`) on `records`.
 * Returns the same records so callers can chain.
 */
export const preloadAssociation = async (
  records: readonly Base[],
  name: string,
): Promise<readonly Base[]> => {
  if (records.length === 0) return records;
  const [head, ...rest] = name.split('.');
  if (!head) return records;
  const ownerClass = records[0]!.constructor as typeof Base;
  const reflection = lookupAssociation(ownerClass, head);
  if (!reflection) throw new Error(`Unknown association "${head}" on ${ownerClass.name}`);

  const next = await preloadOne(records, reflection);
  if (rest.length === 0) return records;
  // Recurse with the children flattened.
  const children: Base[] = [];
  for (const r of next) {
    const cached = (r as Base & { constructor: typeof Base });
    void cached;
  }
  // Flatten children from the cache for the next hop.
  const flat: Base[] = [];
  for (const owner of records) {
    const cached = (owner as unknown as { [k: symbol]: Map<string, Base | Base[] | null> });
    void cached;
    // Use the stable helper to read the cache.
    const value = readCacheValue(owner, head);
    if (Array.isArray(value)) flat.push(...value);
    else if (value) flat.push(value);
  }
  return preloadAssociation(flat, rest.join('.'));
};

/** Issue the batched query for a single hop and populate the cache. */
const preloadOne = async (records: readonly Base[], reflection: AssociationReflection): Promise<readonly Base[]> => {
  switch (reflection.kind) {
    case 'belongs_to':
      return reflection.polymorphic
        ? preloadPolymorphicBelongsTo(records, reflection)
        : preloadBelongsTo(records, reflection);
    case 'has_one':
      return preloadHasOne(records, reflection);
    case 'has_many':
      return preloadHasMany(records, reflection);
  }
};

const preloadBelongsTo = async (records: readonly Base[], reflection: AssociationReflection): Promise<readonly Base[]> => {
  const klass = reflection.classRef!();
  const ids = uniqDefined(records.map((r) => r.readAttribute(reflection.foreignKey)));
  if (ids.length === 0) {
    for (const r of records) setCachedAssociation(r, reflection.name, null);
    return [];
  }
  // biome-ignore lint/suspicious/noExplicitAny: subclass call
  const targets = (await (klass as any).where({ [reflection.primaryKey]: ids }).toArray()) as Base[];
  const byPk = new Map<unknown, Base>();
  for (const t of targets) byPk.set(t.readAttribute(reflection.primaryKey), t);
  for (const r of records) {
    const fk = r.readAttribute(reflection.foreignKey);
    setCachedAssociation(r, reflection.name, fk == null ? null : (byPk.get(fk) ?? null));
  }
  return targets;
};

const preloadPolymorphicBelongsTo = async (records: readonly Base[], reflection: AssociationReflection): Promise<readonly Base[]> => {
  // Group records by `${name}_type` so we can issue one query per concrete class.
  const buckets = new Map<string, Base[]>();
  for (const r of records) {
    const typeName = r.readAttribute(reflection.foreignType!) as string | null;
    if (typeName == null) {
      setCachedAssociation(r, reflection.name, null);
      continue;
    }
    if (!buckets.has(typeName)) buckets.set(typeName, []);
    buckets.get(typeName)!.push(r);
  }
  const all: Base[] = [];
  // Avoid an import cycle by lazy-loading the polymorphic resolver.
  const { resolvePolymorphicClass } = await import('./accessors');
  for (const [typeName, owners] of buckets) {
    const klass = resolvePolymorphicClass(typeName);
    if (!klass) {
      for (const o of owners) setCachedAssociation(o, reflection.name, null);
      continue;
    }
    const ids = uniqDefined(owners.map((o) => o.readAttribute(reflection.foreignKey)));
    if (ids.length === 0) {
      for (const o of owners) setCachedAssociation(o, reflection.name, null);
      continue;
    }
    // biome-ignore lint/suspicious/noExplicitAny: dynamic subclass call
    const targets = (await (klass as any).where({ [reflection.primaryKey]: ids }).toArray()) as Base[];
    const byPk = new Map<unknown, Base>();
    for (const t of targets) byPk.set(t.readAttribute(reflection.primaryKey), t);
    for (const o of owners) {
      const fk = o.readAttribute(reflection.foreignKey);
      setCachedAssociation(o, reflection.name, fk == null ? null : (byPk.get(fk) ?? null));
    }
    all.push(...targets);
  }
  return all;
};

const preloadHasOne = async (records: readonly Base[], reflection: AssociationReflection): Promise<readonly Base[]> => {
  const klass = reflection.classRef!();
  const ids = uniqDefined(records.map((r) => r.readAttribute(reflection.primaryKey)));
  if (ids.length === 0) {
    for (const r of records) setCachedAssociation(r, reflection.name, null);
    return [];
  }
  const conditions: Record<string, unknown> = { [reflection.foreignKey]: ids };
  if (reflection.as) conditions[`${reflection.as}_type`] = records[0]!.constructor.name;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic subclass call
  const targets = (await (klass as any).where(conditions).toArray()) as Base[];
  const byFk = new Map<unknown, Base>();
  for (const t of targets) byFk.set(t.readAttribute(reflection.foreignKey), t);
  for (const r of records) {
    const pk = r.readAttribute(reflection.primaryKey);
    setCachedAssociation(r, reflection.name, byFk.get(pk) ?? null);
  }
  return targets;
};

const preloadHasMany = async (records: readonly Base[], reflection: AssociationReflection): Promise<readonly Base[]> => {
  const klass = reflection.classRef!();
  const ids = uniqDefined(records.map((r) => r.readAttribute(reflection.primaryKey)));
  if (ids.length === 0) {
    for (const r of records) setCachedAssociation(r, reflection.name, []);
    return [];
  }
  const conditions: Record<string, unknown> = { [reflection.foreignKey]: ids };
  if (reflection.as) conditions[`${reflection.as}_type`] = records[0]!.constructor.name;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic subclass call
  const targets = (await (klass as any).where(conditions).toArray()) as Base[];
  const byFk = new Map<unknown, Base[]>();
  for (const t of targets) {
    const key = t.readAttribute(reflection.foreignKey);
    if (!byFk.has(key)) byFk.set(key, []);
    byFk.get(key)!.push(t);
  }
  for (const r of records) {
    const pk = r.readAttribute(reflection.primaryKey);
    setCachedAssociation(r, reflection.name, byFk.get(pk) ?? []);
  }
  return targets;
};

const uniqDefined = (values: unknown[]): unknown[] => {
  const seen = new Set<unknown>();
  const out: unknown[] = [];
  for (const v of values) {
    if (v == null) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

/** Lazy cache lookup that avoids importing the cache symbol at top of file. */
const readCacheValue = (record: Base, name: string): Base | Base[] | null => {
  // biome-ignore lint/suspicious/noExplicitAny: read off the symbol-keyed field
  const cache = (record as any)[Symbol.for('@active-record-ts/active-record:associationCache')] as Map<string, Base | Base[] | null> | undefined;
  return cache?.get(name) ?? null;
};

/** Reference to the target class type, for the public API. */
export type PreloadTarget = BaseConstructor;
