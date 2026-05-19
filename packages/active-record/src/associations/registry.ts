/**
 * Per-class association registry. Like the attribute/validator/callback
 * registries on Model, the association reflections are stored on the
 * constructor itself and inherited through the prototype chain.
 */

import type { AssociationReflection } from './types';

const KEY = Symbol.for('@active-record-ts/active-record:associations');

// biome-ignore lint/suspicious/noExplicitAny: registry attached to constructor
type Ctor = any;

/** Get the association reflection map for a class, creating it if missing. */
export const getAssociations = (ctor: Ctor): Map<string, AssociationReflection> => {
  if (Object.hasOwn(ctor, KEY)) return ctor[KEY] as Map<string, AssociationReflection>;
  const parent = Object.getPrototypeOf(ctor) as Ctor;
  const inherited = parent && parent !== Function.prototype && parent.name ? getAssociations(parent) : null;
  const own = new Map<string, AssociationReflection>(inherited ?? []);
  Object.defineProperty(ctor, KEY, { value: own, enumerable: false, configurable: true, writable: false });
  return own;
};

/** Register a reflection — called by `belongsTo`/`hasMany`/`hasOne`. */
export const registerAssociation = (ctor: Ctor, reflection: AssociationReflection): void => {
  getAssociations(ctor).set(reflection.name, reflection);
};

/** Look up a reflection by accessor name (or `null` if undeclared). */
export const lookupAssociation = (ctor: Ctor, name: string): AssociationReflection | null => {
  return getAssociations(ctor).get(name) ?? null;
};
