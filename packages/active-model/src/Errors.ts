/**
 * Error collection on a model instance. Mirrors `ActiveModel::Errors`
 * minus i18n — message strings are stored verbatim. The full set of
 * Rails behaviors we now support:
 *
 *   - `add(attribute, typeOrMessage, options?)` where the second argument
 *     can be a known symbol-style type (e.g. `'blank'`, `'too_short'`)
 *     that maps to a default message string, or a free-form message.
 *   - `on(attribute)` returns the list of messages for an attribute.
 *   - `attributeNames` returns the unique attributes carrying an error.
 *   - `added(attribute, type?, options?)` predicate.
 *   - `where(attribute, type?, options?)` returns the matching entries.
 *   - `messagesFor` / `fullMessagesFor` with optional type filter.
 *   - `merge(other)` / `copy(other)`.
 */

export type ErrorEntry = {
  attribute: string;
  message: string;
  /** Optional discriminator for the validator that produced this error. */
  type?: string;
  /** Optional structured payload, e.g. `{ count: 2 }` for length validators. */
  options?: Record<string, unknown>;
};

/** Special attribute name for errors that aren't tied to a specific column. */
export const BASE = 'base';

/**
 * Default messages for known error types. Mirrors a small subset of
 * Rails' `errors.messages.*` locale entries — enough to keep tests
 * green without pulling in a full i18n backend. Format strings expand
 * `%{key}` against the options hash at lookup time.
 */
const DEFAULT_MESSAGES: Record<string, string> = {
  invalid: 'is invalid',
  blank: "can't be blank",
  present: 'must be blank',
  too_short: 'is too short (minimum is %{count} characters)',
  too_long: 'is too long (maximum is %{count} characters)',
  wrong_length: 'is the wrong length (should be %{count} characters)',
  taken: 'has already been taken',
  not_a_number: 'is not a number',
  greater_than: 'must be greater than %{count}',
  greater_than_or_equal_to: 'must be greater than or equal to %{count}',
  less_than: 'must be less than %{count}',
  less_than_or_equal_to: 'must be less than or equal to %{count}',
  equal_to: 'must be equal to %{count}',
  odd: 'must be odd',
  even: 'must be even',
  inclusion: 'is not included in the list',
  exclusion: 'is reserved',
  accepted: 'must be accepted',
  confirmation: "doesn't match %{attribute}",
  empty: "can't be empty",
};

const isKnownType = (value: string): boolean => Object.prototype.hasOwnProperty.call(DEFAULT_MESSAGES, value);

const interpolate = (template: string, options: Record<string, unknown> = {}): string =>
  template.replace(/%\{(\w+)\}/g, (_, key) => (key in options ? String(options[key]) : `%{${key}}`));

export type AddOptions = {
  type?: string;
  options?: Record<string, unknown>;
};

export class Errors {
  private readonly entries: ErrorEntry[] = [];

  /**
   * Record an error. The second argument can be:
   *  - a free-form message string (e.g. `errors.add('name', "can't be empty")`)
   *  - a known symbol-style type that resolves to a default message
   *    (e.g. `errors.add('name', 'blank')` -> "can't be blank")
   *
   * Pass extra interpolation values or a custom `type` via the third arg.
   */
  add(attribute: string, messageOrType: string = 'invalid', options: AddOptions & Record<string, unknown> = {}): ErrorEntry {
    const { type: explicitType, options: explicitOptions, message: explicitMessage, ...payload } = options as {
      type?: string;
      options?: Record<string, unknown>;
      message?: string;
    };
    const mergedOptions = { ...payload, ...(explicitOptions ?? {}) };
    let type: string | undefined;
    let message: string;
    if (explicitType) {
      type = explicitType;
      message = explicitMessage ?? (isKnownType(messageOrType) ? interpolate(DEFAULT_MESSAGES[messageOrType]!, mergedOptions) : messageOrType);
    } else if (isKnownType(messageOrType)) {
      type = messageOrType;
      message = explicitMessage ?? interpolate(DEFAULT_MESSAGES[messageOrType]!, mergedOptions);
    } else {
      message = explicitMessage ?? messageOrType;
    }
    const entry: ErrorEntry = {
      attribute,
      message,
      ...(type !== undefined ? { type } : {}),
      ...(Object.keys(mergedOptions).length > 0 ? { options: mergedOptions } : {}),
    };
    this.entries.push(entry);
    return entry;
  }

  /** True when there are no errors at all. */
  get empty(): boolean {
    return this.entries.length === 0;
  }
  /** True when at least one error has been recorded. */
  get any(): boolean {
    return this.entries.length > 0;
  }

  clear(): void {
    this.entries.length = 0;
  }
  delete(attribute: string, type?: string, matchOptions?: Record<string, unknown>): string[] {
    const deleted: string[] = [];
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]!;
      if (e.attribute !== attribute) continue;
      if (type !== undefined && e.type !== type) continue;
      if (matchOptions && !matchesOptions(e.options, matchOptions)) continue;
      deleted.unshift(e.message);
      this.entries.splice(i, 1);
    }
    return deleted;
  }

  on(attribute: string): string[] {
    return this.entries.filter((e) => e.attribute === attribute).map((e) => e.message);
  }
  includes(attribute: string): boolean {
    return this.entries.some((e) => e.attribute === attribute);
  }

  /** All `[attribute, message]` pairs, in insertion order. */
  get messages(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const entry of this.entries) {
      (out[entry.attribute] ??= []).push(entry.message);
    }
    return out;
  }

  /** Distinct attributes that currently carry at least one error. */
  get attributeNames(): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const entry of this.entries) {
      if (!seen.has(entry.attribute)) {
        seen.add(entry.attribute);
        ordered.push(entry.attribute);
      }
    }
    return ordered;
  }

  /** Predicate: was an error matching the given attribute (and optional type / options) added? */
  added(attribute: string, type?: string, matchOptions?: Record<string, unknown>): boolean {
    return this.entries.some((e) => {
      if (e.attribute !== attribute) return false;
      if (type !== undefined && e.type !== type) return false;
      if (matchOptions && !matchesOptions(e.options, matchOptions)) return false;
      return true;
    });
  }

  /** Filter entries by attribute / type / options. */
  where(attribute: string, type?: string, matchOptions?: Record<string, unknown>): ErrorEntry[] {
    return this.entries.filter((e) => {
      if (e.attribute !== attribute) return false;
      if (type !== undefined && e.type !== type) return false;
      if (matchOptions && !matchesOptions(e.options, matchOptions)) return false;
      return true;
    });
  }

  /** Messages for a specific attribute, optionally filtered by type. */
  messagesFor(attribute: string, type?: string): string[] {
    return this.where(attribute, type).map((e) => e.message);
  }

  /** Human-readable strings like `"Name can't be blank"`. */
  get fullMessages(): string[] {
    return this.entries.map((e) => (e.attribute === BASE ? e.message : `${humanize(e.attribute)} ${e.message}`));
  }

  fullMessagesFor(attribute: string, type?: string): string[] {
    return this.where(attribute, type).map((e) => (attribute === BASE ? e.message : `${humanize(attribute)} ${e.message}`));
  }

  /** Standalone full-message formatter (no entries side effect). */
  fullMessage(attribute: string, message: string): string {
    return attribute === BASE ? message : `${humanize(attribute)} ${message}`;
  }

  /** Append every entry from `other` to this collection. */
  merge(other: Errors): this {
    if (other === this) return this;
    for (const entry of other.entries) this.entries.push({ ...entry, options: entry.options ? { ...entry.options } : undefined });
    return this;
  }

  /** Replace this collection's entries with copies of another's. */
  copy(other: Errors): this {
    this.clear();
    return this.merge(other);
  }

  get count(): number {
    return this.entries.length;
  }
  get size(): number {
    return this.entries.length;
  }

  [Symbol.iterator](): IterableIterator<ErrorEntry> {
    return this.entries[Symbol.iterator]();
  }

  toJSON(): Record<string, string[]> {
    return this.messages;
  }
}

/** Two options hashes match when every key in `expected` has the same value in `actual`. */
const matchesOptions = (actual: Record<string, unknown> | undefined, expected: Record<string, unknown>): boolean => {
  if (!actual) return Object.keys(expected).length === 0;
  for (const [k, v] of Object.entries(expected)) {
    if (actual[k] !== v) return false;
  }
  return true;
};

/** Rails-style humanize: split camelCase / snake_case, lower-case everything, then upcase only the first letter. */
const humanize = (attribute: string): string => {
  const spaced = attribute.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
