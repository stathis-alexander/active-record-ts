/**
 * Built-in validators. Each validator implements `validate(record, errors)`.
 * Adapter-level validators (e.g. uniqueness) live in active-record.
 */

import type { Errors } from './Errors';

/**
 * Optional context name passed to `Model#validate(context)`. Mirrors Rails'
 * `valid?(:create)`/`valid?(:update)` — validators with `on` matching the
 * context (or with no `on` at all) are evaluated; others are skipped.
 */
export type ValidationContext = string;

export interface Validator<T = unknown> {
  validate(record: T, errors: Errors, context?: ValidationContext): void | Promise<void>;
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
  /**
   * Custom error message. Can be a string or a function that receives
   * `(record, data)` like Rails' Proc messages, where `data` is
   * `{ attribute, value, type }`.
   */
  message?: string | ((record: T, data: { attribute: string; value: unknown; type?: string }) => string);
  if?: (record: T) => boolean;
  unless?: (record: T) => boolean;
  allowNull?: boolean;
  allowBlank?: boolean;
  /** Limit the validator to one or more validation contexts (e.g. `'create'`). */
  on?: ValidationContext | ValidationContext[];
  /** Skip the validator when the validation context matches one of these. */
  exceptOn?: ValidationContext | ValidationContext[];
  /**
   * When set, validator failures throw immediately instead of accumulating
   * in `record.errors`. Pass `true` for a generic `StrictValidationFailed`
   * or a custom Error subclass to use that instead. Mirrors Rails'
   * `validates(..., strict: true)`.
   */
  strict?: boolean | (new (message: string) => Error);
};

/** Thrown when a validator marked `strict: true` fails. */
export class StrictValidationFailed extends Error {
  constructor(message: string) {
    super(message);
  }
}

const shouldValidate = <T>(record: T, options: ValidatorOptions<T> = {}, context?: ValidationContext): boolean => {
  if (options.on !== undefined) {
    const wanted = Array.isArray(options.on) ? options.on : [options.on];
    if (context === undefined) return false;
    if (!wanted.includes(context)) return false;
  }
  if (options.exceptOn !== undefined && context !== undefined) {
    const excluded = Array.isArray(options.exceptOn) ? options.exceptOn : [options.exceptOn];
    if (excluded.includes(context)) return false;
  }
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
const reader =
  <T>(attribute: string): Reader<T> =>
  (r: T) =>
    (r as Record<string, unknown>)[attribute];

/**
 * Record an error, honoring `strict` if set. With `strict: true`, throws a
 * `StrictValidationFailed` whose message is the humanized "Attribute message".
 * With `strict: SomeError`, throws an instance of that error class instead.
 */
const recordError = <T>(
  options: ValidatorOptions<T>,
  errors: Errors,
  attribute: string,
  defaultMessage: string,
  meta: { type?: string; options?: Record<string, unknown> } = {},
  record?: T,
  value?: unknown,
): void => {
  // Resolve a Proc-style message if the user supplied one; otherwise use
  // their string override; otherwise fall back to the default for this
  // validator.
  let message: string;
  if (typeof options.message === 'function') {
    if (record === undefined) {
      // No record context — fall back to default.
      message = defaultMessage;
    } else {
      message = options.message(record, { attribute, value, type: meta.type });
    }
  } else if (typeof options.message === 'string') {
    message = options.message;
  } else {
    message = defaultMessage;
  }
  if (options.strict) {
    const fullMessage = errors.fullMessage(attribute, message);
    if (typeof options.strict === 'function') {
      throw new options.strict(fullMessage);
    }
    throw new StrictValidationFailed(fullMessage);
  }
  errors.add(attribute, message, meta as never);
};

/**
 * Free-form block validator — wraps a `(record, errors) => void` callback.
 * Exposes `attributes: []` and `kind: 'block'` so introspection (`validators`,
 * `validatorsOn`) can still surface it.
 */
export class BlockValidator<T> implements Validator<T> {
  readonly kind = 'block';
  readonly attributes: string[] = [];
  constructor(
    private readonly fn: (record: T, errors: Errors, context?: ValidationContext) => void | Promise<void>,
    private readonly options: ValidatorOptions<T> = {},
  ) {}
  async validate(record: T, errors: Errors, context?: ValidationContext): Promise<void> {
    if (!shouldValidate(record, this.options, context)) return;
    await this.fn(record, errors, context);
  }
}

export class PresenceValidator<T> implements Validator<T> {
  readonly kind = 'presence';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: ValidatorOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (blank(value)) {
      recordError(this.options, errors, this.attribute, "can't be blank", { type: 'presence' }, record, value);
    }
  }
}

export class AbsenceValidator<T> implements Validator<T> {
  readonly kind = 'absence';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: ValidatorOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (!blank(value)) {
      recordError(this.options, errors, this.attribute, 'must be blank', { type: 'absence' }, record, value);
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
  readonly kind = 'length';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: LengthOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const len = lengthOf(value);
    const o = this.options;
    if (o.in) {
      const [min, max] = o.in;
      if (len < min) {
        recordError(
          this.options,
          errors,
          this.attribute,
          o.tooShort ?? `is too short (minimum is ${min} characters)`,
          { type: 'length' },
          record,
          value,
        );
        return;
      }
      if (len > max) {
        recordError(
          this.options,
          errors,
          this.attribute,
          o.tooLong ?? `is too long (maximum is ${max} characters)`,
          { type: 'length' },
          record,
          value,
        );
        return;
      }
    }
    if (o.is !== undefined && len !== o.is) {
      recordError(
        this.options,
        errors,
        this.attribute,
        o.wrongLength ?? `is the wrong length (should be ${o.is} characters)`,
        { type: 'length' },
        record,
        value,
      );
      return;
    }
    if (o.minimum !== undefined && len < o.minimum) {
      recordError(
        this.options,
        errors,
        this.attribute,
        o.tooShort ?? `is too short (minimum is ${o.minimum} characters)`,
        { type: 'length' },
        record,
        value,
      );
      return;
    }
    if (o.maximum !== undefined && len > o.maximum) {
      recordError(
        this.options,
        errors,
        this.attribute,
        o.tooLong ?? `is too long (maximum is ${o.maximum} characters)`,
        { type: 'length' },
        record,
        value,
      );
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
  readonly kind = 'format';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: FormatOptions<T>,
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const str = value == null ? '' : String(value);
    if (this.options.with && !this.options.with.test(str)) {
      recordError(this.options, errors, this.attribute, 'is invalid', { type: 'format' }, record, value);
    }
    if (this.options.without && this.options.without.test(str)) {
      recordError(this.options, errors, this.attribute, 'is invalid', { type: 'format' }, record, value);
    }
  }
}

export type InclusionOptions<T> = ValidatorOptions<T> & { in: readonly unknown[] };

export class InclusionValidator<T> implements Validator<T> {
  readonly kind = 'inclusion';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: InclusionOptions<T>,
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    if (!this.options.in.includes(value)) {
      recordError(
        this.options,
        errors,
        this.attribute,
        'is not included in the list',
        { type: 'inclusion' },
        record,
        value,
      );
    }
  }
}

export type ExclusionOptions<T> = ValidatorOptions<T> & { in: readonly unknown[] };

export class ExclusionValidator<T> implements Validator<T> {
  readonly kind = 'exclusion';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: ExclusionOptions<T>,
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    if (this.options.in.includes(value)) {
      recordError(this.options, errors, this.attribute, 'is reserved', { type: 'exclusion' }, record, value);
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
  readonly kind = 'numericality';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: NumericalityOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    if (skipForNullable(value, this.options)) return;
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      recordError(this.options, errors, this.attribute, 'is not a number', { type: 'numericality' }, record, value);
      return;
    }
    const o = this.options;
    if (o.onlyInteger && !Number.isInteger(num)) {
      recordError(this.options, errors, this.attribute, 'must be an integer', { type: 'numericality.only_integer' });
    }
    if (o.greaterThan !== undefined && !(num > o.greaterThan)) {
      recordError(
        this.options,
        errors,
        this.attribute,
        `must be greater than ${o.greaterThan}`,
        { type: 'numericality.greater_than' },
        record,
        value,
      );
    }
    if (o.greaterThanOrEqualTo !== undefined && !(num >= o.greaterThanOrEqualTo)) {
      recordError(
        this.options,
        errors,
        this.attribute,
        `must be greater than or equal to ${o.greaterThanOrEqualTo}`,
        { type: 'numericality.greater_than_or_equal_to' },
        record,
        value,
      );
    }
    if (o.lessThan !== undefined && !(num < o.lessThan)) {
      recordError(
        this.options,
        errors,
        this.attribute,
        `must be less than ${o.lessThan}`,
        { type: 'numericality.less_than' },
        record,
        value,
      );
    }
    if (o.lessThanOrEqualTo !== undefined && !(num <= o.lessThanOrEqualTo)) {
      recordError(
        this.options,
        errors,
        this.attribute,
        `must be less than or equal to ${o.lessThanOrEqualTo}`,
        { type: 'numericality.less_than_or_equal_to' },
        record,
        value,
      );
    }
    if (o.equalTo !== undefined && num !== o.equalTo) {
      recordError(
        this.options,
        errors,
        this.attribute,
        `must be equal to ${o.equalTo}`,
        { type: 'numericality.equal_to' },
        record,
        value,
      );
    }
    if (o.odd && num % 2 === 0)
      recordError(this.options, errors, this.attribute, 'must be odd', { type: 'numericality.odd' });
    if (o.even && num % 2 !== 0)
      recordError(this.options, errors, this.attribute, 'must be even', { type: 'numericality.even' });
  }
}

export type AcceptanceOptions<T> = ValidatorOptions<T> & { accept?: readonly unknown[] };

export class AcceptanceValidator<T> implements Validator<T> {
  readonly kind = 'acceptance';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: AcceptanceOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const accept = this.options.accept ?? [true, '1', 1];
    const value = reader<T>(this.attribute)(record);
    if (!accept.includes(value)) {
      recordError(this.options, errors, this.attribute, 'must be accepted', { type: 'acceptance' }, record, value);
    }
  }
}

export type ConfirmationOptions<T> = ValidatorOptions<T> & { caseSensitive?: boolean };

export class ConfirmationValidator<T> implements Validator<T> {
  readonly kind = 'confirmation';
  readonly attributes: string[];
  constructor(
    private readonly attribute: string,
    private readonly options: ConfirmationOptions<T> = {},
  ) {
    this.attributes = [attribute];
  }
  validate(record: T, errors: Errors, context?: ValidationContext): void {
    if (!shouldValidate(record, this.options, context)) return;
    const value = reader<T>(this.attribute)(record);
    const confirmation = reader<T>(`${this.attribute}Confirmation`)(record);
    if (confirmation === undefined) return;
    const a = value == null ? '' : String(value);
    const b = confirmation == null ? '' : String(confirmation);
    const equal = this.options.caseSensitive === false ? a.toLowerCase() === b.toLowerCase() : a === b;
    if (!equal) {
      recordError(
        this.options,
        errors,
        `${this.attribute}Confirmation`,
        "doesn't match",
        { type: 'confirmation' },
        record,
        value,
      );
    }
  }
}
