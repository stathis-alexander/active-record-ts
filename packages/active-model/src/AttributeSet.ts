/**
 * Per-instance attribute storage with dirty tracking.
 *
 * Two layers of values:
 *   - `original` — the value when the record was loaded from the DB (or
 *     last `save`/`commit`). Used to compute the dirty diff.
 *   - `current` — the working value, updated by every assignment.
 *
 * Dirty surface (mirrors Rails' `ActiveModel::Dirty`):
 *   - `changed()`        — list of attribute names that differ from original
 *   - `changes()`        — `{ name: [from, to] }` map of pending changes
 *   - `attributeChanged(name)` — boolean
 *   - `attributeWas(name)`     — original value
 *   - `savedChanges()`         — changes that were applied during the last save
 *   - `attributePreviouslyChanged(name)` — boolean (post-save introspection)
 */

import { type Type, valuesEqual } from './Type';

/** Declaration of a single attribute on a model. */
export type AttributeDefinition = {
  name: string;
  type: Type;
  /** Default applied when a record is new and the attribute is not assigned. */
  default?: unknown;
};

export class AttributeSet {
  private readonly definitions = new Map<string, AttributeDefinition>();
  /** Insertion-ordered list of attribute names, for stable iteration. */
  private readonly names: string[] = [];

  /** Register an attribute (or replace an existing one). */
  define(definition: AttributeDefinition): void {
    if (!this.definitions.has(definition.name)) this.names.push(definition.name);
    this.definitions.set(definition.name, definition);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }
  get(name: string): AttributeDefinition | undefined {
    return this.definitions.get(name);
  }
  keys(): string[] {
    return this.names.slice();
  }
  /** Stable iteration of definitions in declaration order. */
  *[Symbol.iterator](): IterableIterator<AttributeDefinition> {
    for (const name of this.names) yield this.definitions.get(name)!;
  }
  size(): number {
    return this.definitions.size;
  }
  clone(): AttributeSet {
    const copy = new AttributeSet();
    for (const def of this) copy.define(def);
    return copy;
  }
}

/** Per-instance attribute state — values + originals + last-save snapshot. */
export class Attributes {
  private readonly current = new Map<string, unknown>();
  private readonly original = new Map<string, unknown>();
  private previousChanges: Map<string, [unknown, unknown]> = new Map();

  constructor(private readonly set: AttributeSet) {}

  /** Hydrate attributes after loading from the DB. Skips dirty tracking. */
  hydrate(raw: Record<string, unknown>): void {
    for (const def of this.set) {
      const incoming = raw[def.name];
      const value = def.type.deserialize(incoming);
      this.current.set(def.name, value);
      this.original.set(def.name, value);
    }
  }

  /** Hydrate attributes for a brand-new record (applies defaults). */
  hydrateDefaults(overrides: Record<string, unknown> = {}): void {
    for (const def of this.set) {
      const provided = def.name in overrides;
      const raw = provided ? overrides[def.name] : def.default;
      const value = def.type.cast(raw);
      this.current.set(def.name, value);
      this.original.set(def.name, value);
    }
  }

  /** Read an attribute by name, returning the canonical (cast) value. */
  read(name: string): unknown {
    return this.current.get(name);
  }

  /** Write an attribute by name. Type-casts before storing. */
  write(name: string, value: unknown): void {
    const def = this.set.get(name);
    if (!def) {
      this.current.set(name, value);
      return;
    }
    this.current.set(name, def.type.cast(value));
  }

  /** Was this attribute changed since the last commit? */
  changed(name: string): boolean {
    if (!this.current.has(name)) return false;
    const def = this.set.get(name);
    const original = this.original.get(name);
    const value = this.current.get(name);
    if (!def) return original !== value;
    return !valuesEqual(def.type, original as never, value as never);
  }

  /** List of attribute names that differ from their originals. */
  changedAttributes(): string[] {
    const result: string[] = [];
    for (const name of this.set.keys()) {
      if (this.changed(name)) result.push(name);
    }
    return result;
  }

  /** `{ name: [from, to] }` for every changed attribute. */
  changes(): Record<string, [unknown, unknown]> {
    const out: Record<string, [unknown, unknown]> = {};
    for (const name of this.changedAttributes()) {
      out[name] = [this.original.get(name), this.current.get(name)];
    }
    return out;
  }

  /** Original value of `name` (current value if unchanged). */
  was(name: string): unknown {
    return this.original.get(name);
  }

  /** Snapshot for SAVE — return the canonical values for each attribute. */
  toHash(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const name of this.set.keys()) out[name] = this.current.get(name);
    return out;
  }

  /** Snapshot of only the dirty attributes (for UPDATE statements). */
  dirtyHash(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const name of this.changedAttributes()) out[name] = this.current.get(name);
    return out;
  }

  /** Serialized snapshot of all attributes (driver-ready values). */
  serializedHash(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const def of this.set) {
      out[def.name] = def.type.serialize(this.current.get(def.name) as never);
    }
    return out;
  }

  /** Mark the current values as the new baseline. Captures previous changes. */
  commit(): void {
    const previous = new Map<string, [unknown, unknown]>();
    for (const name of this.changedAttributes()) {
      previous.set(name, [this.original.get(name), this.current.get(name)]);
      this.original.set(name, this.current.get(name));
    }
    this.previousChanges = previous;
  }

  /** Drop all pending and recorded changes — used by `clearChangesInformation`. */
  clearChanges(): void {
    for (const [name, value] of this.current) this.original.set(name, value);
    this.previousChanges = new Map();
  }

  /** Revert all pending changes. */
  restore(): void {
    for (const name of this.changedAttributes()) {
      this.current.set(name, this.original.get(name));
    }
  }

  /** Changes that were applied during the last `commit`. */
  savedChanges(): Record<string, [unknown, unknown]> {
    const out: Record<string, [unknown, unknown]> = {};
    for (const [name, pair] of this.previousChanges) out[name] = pair;
    return out;
  }

  attributeSet(): AttributeSet {
    return this.set;
  }
}
