/**
 * Tiny inflector — enough to convert class names into Rails-style table
 * names (`User` -> `users`, `Person` -> `people`, `Octopus` -> `octopi`).
 * Not a substitute for a full inflector (no `inflect.rb` here); add cases
 * as needed.
 */

const IRREGULAR: Array<[string, string]> = [
  ['person', 'people'],
  ['man', 'men'],
  ['woman', 'women'],
  ['child', 'children'],
  ['ox', 'oxen'],
  ['mouse', 'mice'],
  ['octopus', 'octopi'],
  ['cactus', 'cacti'],
  ['goose', 'geese'],
  ['foot', 'feet'],
  ['tooth', 'teeth'],
];

const UNCOUNTABLE = new Set(['equipment', 'information', 'rice', 'money', 'species', 'series', 'fish', 'sheep']);

const PLURAL_RULES: Array<[RegExp, string]> = [
  [/(quiz)$/i, '$1zes'],
  [/^(ox)$/i, '$1en'],
  [/([m|l])ouse$/i, '$1ice'],
  [/(matr|vert|ind)ix|ex$/i, '$1ices'],
  [/(x|ch|ss|sh)$/i, '$1es'],
  [/([^aeiouy]|qu)y$/i, '$1ies'],
  [/(hive)$/i, '$1s'],
  [/(?:([^f])fe|([lr])f)$/i, '$1$2ves'],
  [/sis$/i, 'ses'],
  [/([ti])um$/i, '$1a'],
  [/(buffal|tomat)o$/i, '$1oes'],
  [/(bu)s$/i, '$1ses'],
  [/(alias|status)$/i, '$1es'],
  [/(octop|vir)us$/i, '$1i'],
  [/(ax|test)is$/i, '$1es'],
  [/s$/i, 's'],
  [/$/, 's'],
];

export const pluralize = (word: string): string => {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (UNCOUNTABLE.has(lower)) return word;
  for (const [singular, plural] of IRREGULAR) {
    if (lower === singular) return plural;
    if (lower === plural) return plural;
  }
  for (const [pattern, replacement] of PLURAL_RULES) {
    if (pattern.test(word)) return word.replace(pattern, replacement);
  }
  return `${word}s`;
};

export const underscore = (word: string): string =>
  word
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();

export const camelize = (word: string, lower = false): string => {
  const camel = word
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return lower ? camel.charAt(0).toLowerCase() + camel.slice(1) : camel;
};

/** Convert a class name into a Rails-style table name (`UserAccount` -> `user_accounts`). */
export const tableize = (className: string): string => pluralize(underscore(className));
