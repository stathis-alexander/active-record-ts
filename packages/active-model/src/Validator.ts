/**
 * Built-in validators. Each validator implements `validate(record, errors)`.
 * Adapter-level validators (e.g. uniqueness) live in active-record.
 */

import type { Errors } from './Errors';

export interface Validator<T = unknown> {
  validate(record: T, errors: Errors): void | Promise<void>;
}

type Reader<T> = (record: T) => unknown;

const blank = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Set || value instanceof Map) return value.size === 0;
  return false;
};

/** Common options shared across all validators. */
export type ValidatorOptions<T> = {
  message?: string;
  if?: (record: T) => boolean;
  unless?: (record: T) => boolean;
  allowNull?: boolean;
  allowBlank?: boolean;
};

const shouldValidate = <T>(record: T, options: ValidatorOptions<T> = {}): boolean => {
  if (options.if && !options.if(record)) return false;
  if (options.unless && options.unless(record)) return false;
  return true;
};

const skipForNullable = (value: unknown, options: { allowNull?: boolean; allowBlank?: boolean } = {}): boolean => {
  if (options.allowNull && (value === null || value === undefined)) return true;
  if (options.allowBlank && blank(value)) return true;
  return false;
};

/** Read a value from the record by attribute name, type-safe enough. */
const reader = <T>(attribute: string): Reader<T> => (r: T) => (r as Record<string, unknown>)[attribute];

export class PresenceValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: ValidatorOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (blank(value)) {
      errors.add(this.attribute, this.options.message ?? "can't be blank", { type: 'presence' });
    }
  }
}

export class AbsenceValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: ValidatorOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (!blank(value)) {
      errors.add(this.attribute, this.options.message ?? 'must be blank', { type: 'absence' });
    }
  }
}

export type LengthOptions<T> = ValidatorOptions<T> & {
  minimum?: number;
  maximum?: number;
  is?: number;
  in?: [number, number];
  tooShort?: string;
  tooLong?: string;
  wrongLength?: string;
};

export class LengthValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: LengthOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const len = lengthOf(value);
    const o = this.options;
    if (o.in) {
      const [min, max] = o.in;
      if (len < min) {
        errors.add(this.attribute, o.tooShort ?? `is too short (minimum is ${min} characters)`, { type: 'length' });
        return;
      }
      if (len > max) {
        errors.add(this.attribute, o.tooLong ?? `is too long (maximum is ${max} characters)`, { type: 'length' });
        return;
      }
    }
    if (o.is !== undefined && len !== o.is) {
      errors.add(this.attribute, o.wrongLength ?? `is the wrong length (should be ${o.is} characters)`, { type: 'length' });
      return;
    }
    if (o.minimum !== undefined && len < o.minimum) {
      errors.add(this.attribute, o.tooShort ?? `is too short (minimum is ${o.minimum} characters)`, { type: 'length' });
      return;
    }
    if (o.maximum !== undefined && len > o.maximum) {
      errors.add(this.attribute, o.tooLong ?? `is too long (maximum is ${o.maximum} characters)`, { type: 'length' });
      return;
    }
  }
}

const lengthOf = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === 'string' || Array.isArray(value)) return value.length;
  if (value instanceof Set || value instanceof Map) return value.size;
  return String(value).length;
};

export type FormatOptions<T> = ValidatorOptions<T> & { with?: RegExp; without?: RegExp };

export class FormatValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: FormatOptions<T>) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const str = value == null ? '' : String(value);
    if (this.options.with && !this.options.with.test(str)) {
      errors.add(this.attribute, this.options.message ?? 'is invalid', { type: 'format' });
    }
    if (this.options.without && this.options.without.test(str)) {
      errors.add(this.attribute, this.options.message ?? 'is invalid', { type: 'format' });
    }
  }
}

export type InclusionOptions<T> = ValidatorOptions<T> & { in: readonly unknown[] };

export class InclusionValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: InclusionOptions<T>) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    if (!this.options.in.includes(value)) {
      errors.add(this.attribute, this.options.message ?? 'is not included in the list', { type: 'inclusion' });
    }
  }
}

export type ExclusionOptions<T> = ValidatorOptions<T> & { in: readonly unknown[] };

export class ExclusionValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: ExclusionOptions<T>) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    if (this.options.in.includes(value)) {
      errors.add(this.attribute, this.options.message ?? 'is reserved', { type: 'exclusion' });
    }
  }
}

export type NumericalityOptions<T> = ValidatorOptions<T> & {
  onlyInteger?: boolean;
  greaterThan?: number;
  greaterThanOrEqualTo?: number;
  lessThan?: number;
  lessThanOrEqualTo?: number;
  equalTo?: number;
  odd?: boolean;
  even?: boolean;
};

export class NumericalityValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: NumericalityOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      errors.add(this.attribute, this.options.message ?? 'is not a number', { type: 'numericality' });
      return;
    }
    const o = this.options;
    if (o.onlyInteger && !Number.isInteger(num)) {
      errors.add(this.attribute, 'must be an integer', { type: 'numericality.only_integer' });
    }
    if (o.greaterThan !== undefined && !(num > o.greaterThan)) {
      errors.add(this.attribute, `must be greater than ${o.greaterThan}`, { type: 'numericality.greater_than' });
    }
    if (o.greaterThanOrEqualTo !== undefined && !(num >= o.greaterThanOrEqualTo)) {
      errors.add(this.attribute, `must be greater than or equal to ${o.greaterThanOrEqualTo}`, { type: 'numericality.greater_than_or_equal_to' });
    }
    if (o.lessThan !== undefined && !(num < o.lessThan)) {
      errors.add(this.attribute, `must be less than ${o.lessThan}`, { type: 'numericality.less_than' });
    }
    if (o.lessThanOrEqualTo !== undefined && !(num <= o.lessThanOrEqualTo)) {
      errors.add(this.attribute, `must be less than or equal to ${o.lessThanOrEqualTo}`, { type: 'numericality.less_than_or_equal_to' });
    }
    if (o.equalTo !== undefined && num !== o.equalTo) {
      errors.add(this.attribute, `must be equal to ${o.equalTo}`, { type: 'numericality.equal_to' });
    }
    if (o.odd && num % 2 === 0) errors.add(this.attribute, 'must be odd', { type: 'numericality.odd' });
    if (o.even && num % 2 !== 0) errors.add(this.attribute, 'must be even', { type: 'numericality.even' });
  }
}

export type AcceptanceOptions<T> = ValidatorOptions<T> & { accept?: readonly unknown[] };

export class AcceptanceValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: AcceptanceOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const accept = this.options.accept ?? [true, '1', 1];
    const value = reader<T>(this.attribute)(record);
    if (!accept.includes(value)) {
      errors.add(this.attribute, this.options.message ?? 'must be accepted', { type: 'acceptance' });
    }
  }
}

export type ConfirmationOptions<T> = ValidatorOptions<T> & { caseSensitive?: boolean };

export class ConfirmationValidator<T> implements Validator<T> {
  constructor(private readonly attribute: string, private readonly options: ConfirmationOptions<T> = {}) {}
  validate(record: T, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const value = reader<T>(this.attribute)(record);
    const confirmation = reader<T>(`${this.attribute}Confirmation`)(record);
    if (confirmation === undefined) return;
    const a = value == null ? '' : String(value);
    const b = confirmation == null ? '' : String(confirmation);
    const equal = this.options.caseSensitive === false ? a.toLowerCase() === b.toLowerCase() : a === b;
    if (!equal) {
      errors.add(`${this.attribute}Confirmation`, this.options.message ?? "doesn't match", { type: 'confirmation' });
    }
  }
}
