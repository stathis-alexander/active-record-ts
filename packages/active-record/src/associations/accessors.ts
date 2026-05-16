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
  if (Object.prototype.hasOwnProperty.call(ctor.prototype, name)) return;

  if (kind === 'belongs_to') {
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: false,
      get(this: Base) {
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
        return readHasOne(this, reflection);
      },
    });
    return;
  }

  // has_many — returns a Relation, which is chainable AND thenable.
  Object.defineProperty(ctor.prototype, name, {
    configurable: true,
    enumerable: false,
    get(this: Base) {
      return buildHasManyRelation(this, reflection);
    },
  });
};

/** Resolve the target class for an association at access time. */
const targetClass = (owner: Base, reflection: AssociationReflection): BaseConstructor | null => {
  if (reflection.polymorphic) {
    const typeName = owner.readAttribute(reflection.foreignType!) as string | null;
    if (typeName == null) return null;
    const klass = resolvePolymorphicClass(typeName);
    if (!klass) throw new Error(`Unknown polymorphic class "${typeName}" — call Base.polymorphicAs(${JSON.stringify(typeName)}, ClassName) to register it`);
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
