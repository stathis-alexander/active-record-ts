/**
 * Shared types for the association layer. Each kind of association
 * (belongs_to / has_many / has_one) carries a reflection record on the
 * declaring class. Accessors are installed on the prototype at
 * declaration time.
 */

import type { Base, BaseConstructor } from '../Base';

/** Discriminator for the three association flavors we ship in PR A. */
export type AssociationKind = 'belongs_to' | 'has_many' | 'has_one';

/** Lazy reference to the target class — avoids circular imports between models. */
export type ClassRef<T extends Base = Base> = () => BaseConstructor<T>;

export type BelongsToOptions = {
  /** Lazy reference to the target class. Required for non-polymorphic. */
  class?: ClassRef;
  /** Foreign key column on this model. Default: `${name}_id`. */
  foreignKey?: string;
  /** Primary key column on the target. Default: target.primaryKey. */
  primaryKey?: string;
  /** Marks this as a polymorphic belongs_to — adds a `${name}_type` column. */
  polymorphic?: boolean;
  /** Allow `null` association values (default true). */
  optional?: boolean;
};

export type HasManyOptions = {
  /** Lazy reference to the target class. Required unless `as:` polymorphic or `through:`. */
  class?: ClassRef;
  /** Foreign key on the OWNED side (target). Default inferred from declaring class. */
  foreignKey?: string;
  /** Primary key on this model. Default: this.primaryKey. */
  primaryKey?: string;
  /** Polymorphic interface name (matches a belongs_to `polymorphic: true` on the target). */
  as?: string;
  /** Action when the owner is destroyed. */
  dependent?: 'destroy' | 'delete_all' | 'nullify';
  /**
   * Name of an intermediate association already declared on this class.
   * `User.hasMany('memberships'); User.hasMany('teams', { through: 'memberships' })`.
   */
  through?: string;
  /** Name of the association on the through-model that points at the final target. */
  source?: string;
};

export type HasOneOptions = HasManyOptions;

/** Resolved reflection — what the runtime stores after a `belongsTo/hasMany/hasOne` call. */
export type AssociationReflection = {
  kind: AssociationKind;
  /** The accessor / declaration name (e.g. `'user'`, `'posts'`). */
  name: string;
  /** Lazy class lookup. `null` for polymorphic belongs_to or unresolved `through`. */
  classRef: ClassRef | null;
  /** Foreign key on whichever side holds it. */
  foreignKey: string;
  primaryKey: string;
  /** True for `belongs_to(..., polymorphic: true)`. */
  polymorphic: boolean;
  /** Column storing the target class name on the FK side, when polymorphic. */
  foreignType?: string;
  /** Polymorphic interface name on the inverse `has_many { as: 'commentable' }`. */
  as?: string;
  optional: boolean;
  dependent?: 'destroy' | 'delete_all' | 'nullify';
  /** Intermediate association name for has_many :through. */
  through?: string;
  /** Source association name on the through-model. Defaults to `name` singularized. */
  source?: string;
};
