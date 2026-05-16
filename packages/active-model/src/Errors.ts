/**
 * Error collection on a model instance. Mirrors `ActiveModel::Errors`
 * minus i18n — message strings are stored verbatim.
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

export class Errors {
  private readonly entries: ErrorEntry[] = [];

  add(attribute: string, message: string, options?: { type?: string; options?: Record<string, unknown> }): void {
    this.entries.push({ attribute, message, type: options?.type, options: options?.options });
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
  delete(attribute: string): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]?.attribute === attribute) this.entries.splice(i, 1);
    }
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

  /** Human-readable strings like `"name can't be blank"`. */
  get fullMessages(): string[] {
    return this.entries.map((e) => (e.attribute === BASE ? e.message : `${humanize(e.attribute)} ${e.message}`));
  }

  fullMessagesFor(attribute: string): string[] {
    return this.on(attribute).map((m) => (attribute === BASE ? m : `${humanize(attribute)} ${m}`));
  }

  get count(): number {
    return this.entries.length;
  }
  get size(): number {
    return this.entries.length;
  }

  /** Iterate raw entries, e.g. for log formatting. */
  [Symbol.iterator](): IterableIterator<ErrorEntry> {
    return this.entries[Symbol.iterator]();
  }

  toJSON(): Record<string, string[]> {
    return this.messages;
  }
}

const humanize = (attribute: string): string => {
  const spaced = attribute.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
