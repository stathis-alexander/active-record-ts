/**
 * `Model` is the active-model base — handles attribute storage, dirty
 * tracking, validation, and callbacks. ActiveRecord's `Base` subclasses
 * this to add persistence.
 *
 * Subclasses declare attributes with `static attribute(name, type)` or
 * by populating the static `attributesSchema` (the AR layer does this
 * automatically from `loadSchema`).
 */

import { Attributes, AttributeSet } from './AttributeSet';
import { CallbackChain, type CallbackEvent, type CallbackFn, type AroundCallbackFn, type CallbackKind } from './Callbacks';
import { Errors } from './Errors';
import { lookupType, type Type } from './Type';
import {
  AcceptanceValidator,
  type AcceptanceOptions,
  AbsenceValidator,
  ConfirmationValidator,
  type ConfirmationOptions,
  ExclusionValidator,
  type ExclusionOptions,
  FormatValidator,
  type FormatOptions,
  InclusionValidator,
  type InclusionOptions,
  LengthValidator,
  type LengthOptions,
  NumericalityValidator,
  type NumericalityOptions,
  PresenceValidator,
  type ValidationContext,
  type Validator,
  type ValidatorOptions,
} from './Validator';

/** A type reference accepted by `Model.attribute` — either a name or a Type instance. */
export type TypeRef = string | Type;

/** Thrown by `Model#validateOrThrow` (mirrors Rails' `ActiveModel::ValidationError`). */
export class ValidationError extends Error {
  constructor(public record: Model) {
    super(`Validation failed: ${record.errors.fullMessages.join(', ')}`);
  }
}

const resolveType = (ref: TypeRef): Type => (typeof ref === 'string' ? lookupType(ref) : ref);

/**
 * Hidden registry attached to each Model subclass. Stored as a non-
 * enumerable property keyed by a symbol so it doesn't leak into the
 * subclass shape — but discoverable from any prototype.
 */
const REGISTRY = Symbol.for('@arelts/active-model:registry');

type Registry<T extends Model> = {
  attributeSet: AttributeSet;
  validators: Validator<T>[];
  callbacks: CallbackChain<T>;
};

const getRegistry = <T extends Model>(ctor: typeof Model): Registry<T> => {
  // biome-ignore lint/suspicious/noExplicitAny: registry is constructor-owned
  const own = (ctor as any)[REGISTRY] as Registry<T> | undefined;
  if (own && Object.prototype.hasOwnProperty.call(ctor, REGISTRY)) return own;
  // Walk the prototype chain to inherit then copy down.
  const parent = Object.getPrototypeOf(ctor) as typeof Model | null;
  const parentReg = parent && parent !== Function.prototype ? getRegistry<T>(parent) : null;
  const fresh: Registry<T> = {
    attributeSet: parentReg ? parentReg.attributeSet.clone() : new AttributeSet(),
    validators: parentReg ? [...parentReg.validators] : [],
    callbacks: new CallbackChain<T>(),
  };
  if (parentReg) fresh.callbacks.inheritFrom(parentReg.callbacks);
  Object.defineProperty(ctor, REGISTRY, { value: fresh, enumerable: false, configurable: true, writable: false });
  return fresh;
};

/**
 * Camelize a Rails-style snake_case name into a method-friendly suffix
 * (e.g. `'first_name'` -> `'FirstName'`). Used to derive per-attribute
 * dirty helper names like `firstNameChanged()`.
 */
const camelizeSuffix = (name: string): string =>
  name.replace(/(?:^|[_-])([a-z0-9])/gi, (_, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');

/**
 * Install per-attribute dirty helpers on the prototype: `nameChanged()`,
 * `nameWas()`, `nameChange()`, `restoreName()`. Mirrors a slice of
 * `ActiveModel::Dirty`'s generated methods.
 */
const definePerAttributeDirty = (target: typeof Model, names: string[]): void => {
  for (const name of names) {
    const suffix = camelizeSuffix(name);
    const helpers: Record<string, (this: Model, ...args: unknown[]) => unknown> = {
      [`${lowerFirst(suffix)}Changed`](this: Model) {
        return this.attributeChanged(name);
      },
      [`${lowerFirst(suffix)}Was`](this: Model) {
        return this.attributeWas(name);
      },
      [`${lowerFirst(suffix)}Change`](this: Model): [unknown, unknown] | null {
        if (!this.attributeChanged(name)) return null;
        return [this.attributeWas(name), this.readAttribute(name)];
      },
      [`restore${suffix}`](this: Model) {
        // Reset just this one attribute to its original value.
        this.writeAttribute(name, this.attributeWas(name));
      },
    };
    for (const [methodName, fn] of Object.entries(helpers)) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, methodName)) continue;
      Object.defineProperty(target.prototype, methodName, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: fn,
      });
    }
  }
};

const lowerFirst = (s: string): string => (s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Accessor proxy installed on subclass prototypes so `record.name` reads `attributes`. */
const defineAccessors = (target: typeof Model, names: string[]): void => {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(target.prototype, name)) continue;
    Object.defineProperty(target.prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: Model) {
        return this.readAttribute(name);
      },
      set(this: Model, value: unknown) {
        this.writeAttribute(name, value);
      },
    });
  }
};

export class Model {
  /** Per-instance attribute state, lazily initialized. */
  protected _attributes!: Attributes;
  /** Per-instance error collection. */
  public readonly errors: Errors = new Errors();

  // biome-ignore lint/complexity/noBannedTypes: constructor body sets up attributes uniformly
  constructor(values: Record<string, unknown> = {}) {
    const ctor = this.constructor as typeof Model;
    const reg = getRegistry<this>(ctor);
    this._attributes = new Attributes(reg.attributeSet);
    this._attributes.hydrateDefaults(values);
    const names = reg.attributeSet.keys();
    defineAccessors(ctor, names);
    definePerAttributeDirty(ctor, names);
  }

  // ──────────────────────────── attribute IO ────────────────────────────

  readAttribute(name: string): unknown {
    return this._attributes.read(name);
  }
  writeAttribute(name: string, value: unknown): void {
    this._attributes.write(name, value);
  }
  /** Plain object snapshot. */
  attributes(): Record<string, unknown> {
    return this._attributes.toHash();
  }
  assignAttributes(values: Record<string, unknown>): this {
    for (const [name, value] of Object.entries(values)) this.writeAttribute(name, value);
    return this;
  }

  // ──────────────────────────── dirty tracking ────────────────────────────

  changed(): string[] {
    return this._attributes.changedAttributes();
  }
  changes(): Record<string, [unknown, unknown]> {
    return this._attributes.changes();
  }
  attributeChanged(name: string): boolean {
    return this._attributes.changed(name);
  }
  attributeWas(name: string): unknown {
    return this._attributes.was(name);
  }
  savedChanges(): Record<string, [unknown, unknown]> {
    return this._attributes.savedChanges();
  }
  restoreAttributes(): void {
    this._attributes.restore();
  }
  /** Reset both pending and last-saved changes — Rails' `clear_changes_information`. */
  clearChangesInformation(): void {
    this._attributes.clearChanges();
  }

  // ──────────────────────────── validation ────────────────────────────

  async validate(context?: ValidationContext): Promise<boolean> {
    this.errors.clear();
    const ctor = this.constructor as typeof Model;
    const reg = getRegistry<this>(ctor);
    await reg.callbacks.run('validation', this, async () => {
      for (const v of reg.validators) await v.validate(this, this.errors, context);
    }, context);
    return this.errors.empty;
  }
  async isValid(context?: ValidationContext): Promise<boolean> {
    return this.validate(context);
  }
  async isInvalid(context?: ValidationContext): Promise<boolean> {
    return !(await this.validate(context));
  }
  /** Mirrors Rails' `validate!`. Throws when invalid, returns true otherwise. */
  async validateOrThrow(context?: ValidationContext): Promise<boolean> {
    const ok = await this.validate(context);
    if (!ok) throw new ValidationError(this);
    return true;
  }

  // ──────────────────────────── helpers ────────────────────────────

  toJSON(): Record<string, unknown> {
    return this.attributes();
  }

  // ──────────────────────────── class-side configuration ────────────────────────────

  /** Register an attribute on this subclass. Returns the constructor for chaining. */
  static attribute<This extends typeof Model>(this: This, name: string, type: TypeRef, options?: { default?: unknown }): This {
    const reg = getRegistry(this);
    reg.attributeSet.define({ name, type: resolveType(type), default: options?.default });
    defineAccessors(this, [name]);
    definePerAttributeDirty(this, [name]);
    return this;
  }

  /** Access the per-class `AttributeSet`. */
  static attributesSchema<This extends typeof Model>(this: This): AttributeSet {
    return getRegistry(this).attributeSet;
  }

  /** Register a validator instance. */
  static validatesWith<This extends typeof Model>(this: This, validator: Validator<InstanceType<This>>): This {
    getRegistry(this).validators.push(validator as Validator<Model>);
    return this;
  }

  /** Add a presence validator. */
  static validatesPresenceOf<This extends typeof Model>(this: This, attribute: string, options: ValidatorOptions<InstanceType<This>> = {}): This {
    return this.validatesWith(new PresenceValidator(attribute, options));
  }
  static validatesAbsenceOf<This extends typeof Model>(this: This, attribute: string, options: ValidatorOptions<InstanceType<This>> = {}): This {
    return this.validatesWith(new AbsenceValidator(attribute, options));
  }
  static validatesLengthOf<This extends typeof Model>(this: This, attribute: string, options: LengthOptions<InstanceType<This>>): This {
    return this.validatesWith(new LengthValidator(attribute, options));
  }
  static validatesFormatOf<This extends typeof Model>(this: This, attribute: string, options: FormatOptions<InstanceType<This>>): This {
    return this.validatesWith(new FormatValidator(attribute, options));
  }
  static validatesInclusionOf<This extends typeof Model>(this: This, attribute: string, options: InclusionOptions<InstanceType<This>>): This {
    return this.validatesWith(new InclusionValidator(attribute, options));
  }
  static validatesExclusionOf<This extends typeof Model>(this: This, attribute: string, options: ExclusionOptions<InstanceType<This>>): This {
    return this.validatesWith(new ExclusionValidator(attribute, options));
  }
  static validatesNumericalityOf<This extends typeof Model>(this: This, attribute: string, options: NumericalityOptions<InstanceType<This>> = {}): This {
    return this.validatesWith(new NumericalityValidator(attribute, options));
  }
  static validatesAcceptanceOf<This extends typeof Model>(this: This, attribute: string, options: AcceptanceOptions<InstanceType<This>> = {}): This {
    return this.validatesWith(new AcceptanceValidator(attribute, options));
  }
  static validatesConfirmationOf<This extends typeof Model>(this: This, attribute: string, options: ConfirmationOptions<InstanceType<This>> = {}): This {
    return this.validatesWith(new ConfirmationValidator(attribute, options));
  }

  /**
   * Sugar mirroring Rails' `validates :name, presence: true, length: { minimum: 2 }`.
   */
  static validates<This extends typeof Model>(this: This, attribute: string, rules: {
    presence?: boolean | ValidatorOptions<InstanceType<This>>;
    absence?: boolean | ValidatorOptions<InstanceType<This>>;
    length?: LengthOptions<InstanceType<This>>;
    format?: FormatOptions<InstanceType<This>>;
    inclusion?: InclusionOptions<InstanceType<This>>;
    exclusion?: ExclusionOptions<InstanceType<This>>;
    numericality?: boolean | NumericalityOptions<InstanceType<This>>;
    acceptance?: boolean | AcceptanceOptions<InstanceType<This>>;
    confirmation?: boolean | ConfirmationOptions<InstanceType<This>>;
  }): This {
    if (rules.presence) this.validatesPresenceOf(attribute, rules.presence === true ? {} : rules.presence);
    if (rules.absence) this.validatesAbsenceOf(attribute, rules.absence === true ? {} : rules.absence);
    if (rules.length) this.validatesLengthOf(attribute, rules.length);
    if (rules.format) this.validatesFormatOf(attribute, rules.format);
    if (rules.inclusion) this.validatesInclusionOf(attribute, rules.inclusion);
    if (rules.exclusion) this.validatesExclusionOf(attribute, rules.exclusion);
    if (rules.numericality) this.validatesNumericalityOf(attribute, rules.numericality === true ? {} : rules.numericality);
    if (rules.acceptance) this.validatesAcceptanceOf(attribute, rules.acceptance === true ? {} : rules.acceptance);
    if (rules.confirmation) this.validatesConfirmationOf(attribute, rules.confirmation === true ? {} : rules.confirmation);
    return this;
  }

  // ──────────────────────────── callbacks ────────────────────────────

  /** Options that can be passed to any callback registration helper. */
  static setCallback<This extends typeof Model>(
    this: This,
    event: CallbackEvent,
    kind: CallbackKind,
    fn: CallbackFn<InstanceType<This>> | AroundCallbackFn<InstanceType<This>>,
    options?: {
      if?: (record: InstanceType<This>) => boolean;
      unless?: (record: InstanceType<This>) => boolean;
      on?: string | string[];
    },
  ): This {
    getRegistry(this).callbacks.add(event, kind, fn as never, options as never);
    return this;
  }

  static beforeValidation<This extends typeof Model>(
    this: This,
    fn: CallbackFn<InstanceType<This>>,
    options?: { on?: string | string[]; if?: (record: InstanceType<This>) => boolean; unless?: (record: InstanceType<This>) => boolean },
  ): This {
    return this.setCallback('validation', 'before', fn, options);
  }
  static afterValidation<This extends typeof Model>(
    this: This,
    fn: CallbackFn<InstanceType<This>>,
    options?: { on?: string | string[]; if?: (record: InstanceType<This>) => boolean; unless?: (record: InstanceType<This>) => boolean },
  ): This {
    return this.setCallback('validation', 'after', fn, options);
  }
  static beforeSave<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('save', 'before', fn);
  }
  static afterSave<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('save', 'after', fn);
  }
  static aroundSave<This extends typeof Model>(this: This, fn: AroundCallbackFn<InstanceType<This>>): This {
    return this.setCallback('save', 'around', fn);
  }
  static beforeCreate<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('create', 'before', fn);
  }
  static afterCreate<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('create', 'after', fn);
  }
  static beforeUpdate<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('update', 'before', fn);
  }
  static afterUpdate<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('update', 'after', fn);
  }
  static beforeDestroy<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('destroy', 'before', fn);
  }
  static afterDestroy<This extends typeof Model>(this: This, fn: CallbackFn<InstanceType<This>>): This {
    return this.setCallback('destroy', 'after', fn);
  }

  /** Run a registered callback chain — typically used by ActiveRecord persistence. */
  static async runCallbacks<This extends typeof Model>(
    this: This,
    event: CallbackEvent,
    record: InstanceType<This>,
    body: () => Promise<void>,
    context?: string,
  ): Promise<boolean> {
    return getRegistry(this).callbacks.run(event, record, body, context);
  }
}
