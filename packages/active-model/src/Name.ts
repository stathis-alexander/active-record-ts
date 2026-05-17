/**
 * `Name` — Rails-style `ActiveModel::Name`. Exposes singular/plural/
 * element/collection/route_key/param_key/i18n_key/human/uncountable
 * derivations for a class name. We compute these purely from the class
 * name via the inflector — no i18n, no class introspection.
 */

import { pluralize, underscore } from './inflector';

const UNCOUNTABLE = new Set(['equipment', 'information', 'rice', 'money', 'species', 'series', 'fish', 'sheep']);

const humanize = (word: string): string => {
  const spaced = word.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export class Name {
  /** The class itself (or its name, when called with a class-name string). */
  readonly klass: { name: string };
  /** The fully-qualified class name as written. */
  readonly name: string;
  /** Snake-case version of the (possibly namespaced) class name. e.g. `Post::TrackBack` -> `post_track_back`. */
  readonly singular: string;
  /** Plural form of `singular`. e.g. `post_track_back` -> `post_track_backs`. */
  readonly plural: string;
  /** Last segment, snake-cased. e.g. `Post::TrackBack` -> `track_back`. */
  readonly element: string;
  /** Forward-slash-joined collection name. e.g. `Post::TrackBack` -> `post/track_backs`. */
  readonly collection: string;
  /** Rails routing helper — plural element with optional namespace prefix. */
  readonly route_key: string;
  /** `singular` minus internal namespace separators. */
  readonly param_key: string;
  /** Slash-joined namespace key. e.g. `Post::TrackBack` -> `post/track_back`. */
  readonly i18n_key: string;
  /** Human-friendly element name. e.g. `track_back` -> `Track back`. */
  readonly human: string;

  /**
   * Build a `Name` from a class (uses `klass.name`) or directly from a
   * Ruby-style namespaced string ("Post::TrackBack").
   */
  constructor(klassOrName: string | { name: string }) {
    this.klass = typeof klassOrName === 'string' ? { name: klassOrName } : klassOrName;
    this.name = this.klass.name;
    const parts = this.name.split('::');
    const last = parts[parts.length - 1]!;
    const nsParts = parts.slice(0, -1).map((p) => underscore(p));
    const lastSnake = underscore(last);
    this.singular = [...nsParts, lastSnake].join('_');
    this.plural = pluralize(this.singular);
    this.element = lastSnake;
    const elementPlural = pluralize(lastSnake);
    this.collection = nsParts.length === 0 ? elementPlural : `${nsParts.join('/')}/${elementPlural}`;
    this.route_key = nsParts.length === 0 ? elementPlural : `${nsParts.join('_')}_${elementPlural}`;
    this.param_key = this.singular;
    this.i18n_key = nsParts.length === 0 ? lastSnake : `${nsParts.join('/')}/${lastSnake}`;
    this.human = humanize(lastSnake);
  }

  /** Whether the singular form is uncountable (plural === singular). */
  get uncountable(): boolean {
    return UNCOUNTABLE.has(this.singular.toLowerCase());
  }

  toString(): string {
    return this.name;
  }
}
