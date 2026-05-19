/**
 * Generates the per-instance accessors backing each association. We
 * install a getter on the model prototype that:
 *
 *   - For `belongs_to` / `has_one` → returns a `Promise<Target | null>`.
 *   - For `has_many`               → returns a `Relation<Target>` that the
 *     caller can chain or `await` directly.
 *
 * Polymorphic `belongs_to` resolves the target class from the
 * `${name}_type` column at access time, then defers to the standard path.
 */

import { Relation } from '../Relation';
import type { Base, BaseConstructor } from '../Base';
import type { AssociationReflection } from './types';

/** Symbol marker for the per-instance association cache populated by Preloader. */
export const ASSOCIATION_CACHE = Symbol.for('@active-record-ts/active-record:associationCache');

type AssociationCache = Map<string, Base | Base[] | null>;

/** Read the association cache off a record, creating it on demand. */
export const getAssociationCache = (record: Base): AssociationCache => {
  // biome-ignore lint/suspicious/noExplicitAny: cache lives on the instance
  const r = record as any;
  if (!r[ASSOCIATION_CACHE]) r[ASSOCIATION_CACHE] = new Map<string, Base | Base[] | null>();
  return r[ASSOCIATION_CACHE] as AssociationCache;
};

/** Plant a preloaded value into the association cache for `record`. */
export const setCachedAssociation = (record: Base, name: string, value: Base | Base[] | null): void => {
  getAssociationCache(record).set(name, value);
};

/** True when `record` has a preloaded value for `name`. */
export const hasCachedAssociation = (record: Base, name: string): boolean => {
  return getAssociationCache(record).has(name);
};

/** Module-level registry of resolvable polymorphic class names. Populated by Base.polymorphicAs. */
const POLYMORPHIC_REGISTRY = new Map<string, BaseConstructor>();

export const registerPolymorphicClass = (typeName: string, ctor: BaseConstructor): void => {
  POLYMORPHIC_REGISTRY.set(typeName, ctor);
};

export const resolvePolymorphicClass = (typeName: string): BaseConstructor | null => {
  return POLYMORPHIC_REGISTRY.get(typeName) ?? null;
};

/** Install a single accessor on `ctor.prototype` for the given reflection. */
export const defineAssociationAccessor = (ctor: typeof Base, reflection: AssociationReflection): void => {
  const { name, kind } = reflection;
  if (Object.hasOwn(ctor.prototype, name)) return;

  // has_many :through resolves lazily via the intermediate association at access time.
  if (reflection.through) {
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: false,
      get(this: Base) {
        const cache = getAssociationCache(this);
        if (cache.has(name)) return Promise.resolve((cache.get(name) as Base[]) ?? []);
        return readThrough(this, reflection);
      },
    });
    return;
  }

  if (kind === 'belongs_to') {
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: false,
      get(this: Base) {
        // Cache check: if a Preloader populated us, return the cached value.
        const cache = getAssociationCache(this);
        if (cache.has(name)) return Promise.resolve(cache.get(name) as Base | null);
        return readBelongsTo(this, reflection);
      },
    });
    return;
  }

  if (kind === 'has_one') {
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: false,
      get(this: Base) {
        const cache = getAssociationCache(this);
        if (cache.has(name)) return Promise.resolve(cache.get(name) as Base | null);
        return readHasOne(this, reflection);
      },
    });
    return;
  }

  // has_many — returns a Relation, which is chainable AND thenable. When
  // preloaded, we wrap the cached array in a tiny thenable that still
  // exposes the most-common chain methods (where/order/limit) so callers
  // who chain after a preload get expected behavior — chains issue a
  // fresh query rather than filtering the cached array.
  Object.defineProperty(ctor.prototype, name, {
    configurable: true,
    enumerable: false,
    get(this: Base) {
      const cache = getAssociationCache(this);
      const fresh = buildHasManyRelation(this, reflection);
      if (cache.has(name)) {
        const cached = (cache.get(name) as Base[]) ?? [];
        // biome-ignore lint/suspicious/noExplicitAny: lightweight proxy
        const r = fresh as any;
        const originalThen = r.then.bind(r);
        r.then = (onF: (v: unknown[]) => unknown, onR?: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(onF(cached));
          } catch (e) {
            return onR ? Promise.resolve(onR(e)) : Promise.reject(e);
          }
        };
        r.toArray = async () => cached;
        return fresh;
      }
      return fresh;
    },
  });
};

/** Resolve the target class for an association at access time. */
const targetClass = (owner: Base, reflection: AssociationReflection): BaseConstructor | null => {
  if (reflection.polymorphic) {
    const typeName = owner.readAttribute(reflection.foreignType!) as string | null;
    if (typeName == null) return null;
    const klass = resolvePolymorphicClass(typeName);
    if (!klass)
      throw new Error(
        `Unknown polymorphic class "${typeName}" — call Base.polymorphicAs(${JSON.stringify(typeName)}, ClassName) to register it`,
      );
    return klass;
  }
  if (!reflection.classRef) throw new Error(`Association "${reflection.name}" missing class reference`);
  return reflection.classRef();
};

const readBelongsTo = async (owner: Base, reflection: AssociationReflection): Promise<Base | null> => {
  const fk = owner.readAttribute(reflection.foreignKey);
  if (fk == null) return null;
  const klass = targetClass(owner, reflection);
  if (!klass) return null;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic findBy on subclass
  return await (klass as any).findBy({ [reflection.primaryKey]: fk });
};

const readHasOne = async (owner: Base, reflection: AssociationReflection): Promise<Base | null> => {
  const klass = targetClass(owner, reflection);
  if (!klass) return null;
  const id = owner.readAttribute(reflection.primaryKey);
  if (id == null) return null;
  const conditions: Record<string, unknown> = { [reflection.foreignKey]: id };
  if (reflection.as) conditions[`${reflection.as}_type`] = owner.constructor.name;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic findBy on subclass
  return await (klass as any).findBy(conditions);
};

/**
 * `has_many :through` reader. Walks the intermediate association first,
 * then collects the source association on each intermediate. Implemented
 * as two batched queries so it stays N+1-free at the access level.
 */
const readThrough = async (owner: Base, reflection: AssociationReflection): Promise<Base[]> => {
  const { lookupAssociation } = await import('./registry');
  const ownerClass = owner.constructor as typeof Base;
  const through = lookupAssociation(ownerClass, reflection.through!);
  if (!through) {
    throw new Error(`Unknown through-association "${reflection.through}" on ${ownerClass.name}`);
  }
  const sourceName = reflection.source ?? singularize(reflection.name);
  const intermediateRel = buildHasManyRelation(owner, through);
  const intermediates = await intermediateRel.toArray();
  if (intermediates.length === 0) return [];
  const interClass = intermediates[0]!.constructor as typeof Base;
  if (!lookupAssociation(interClass, sourceName)) {
    throw new Error(
      `Through association "${reflection.name}" on ${ownerClass.name}: source "${sourceName}" not found on ${interClass.name}`,
    );
  }
  const { preloadAssociation } = await import('./Preloader');
  await preloadAssociation(intermediates, sourceName);
  const results: Base[] = [];
  for (const mid of intermediates) {
    const cache = getAssociationCache(mid);
    const v = cache.get(sourceName);
    if (Array.isArray(v)) results.push(...v);
    else if (v) results.push(v);
  }
  return results;
};

const singularize = (word: string): string => {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
};

const buildHasManyRelation = (owner: Base, reflection: AssociationReflection): Relation<Base> => {
  const klass = targetClass(owner, reflection);
  if (!klass) {
    // No target (polymorphic without registration) — return an empty no-op relation.
    // We still need a Relation<Base> to satisfy the shape; build one against the owner's
    // own class and immediately mark it none(), so awaits resolve to [].
    return new Relation(owner.constructor as BaseConstructor<Base>).none();
  }
  const id = owner.readAttribute(reflection.primaryKey);
  const conditions: Record<string, unknown> = { [reflection.foreignKey]: id };
  if (reflection.as) conditions[`${reflection.as}_type`] = owner.constructor.name;
  if (id == null) {
    return new Relation(klass as BaseConstructor<Base>).none();
  }
  return new Relation(klass as BaseConstructor<Base>).where(conditions);
};
