import { Attribute } from '../Attribute';
import type { BindValue, Quotable } from '../types';
import { hash } from '../utilities/hash';
import { type FetchAttributeCallback, Node } from './Node';

/** Attribute-like values that HomogeneousIn can target. */
type HomogeneousAttribute =
  | Attribute
  | {
      typeCaster?: () => unknown;
      relation?: { quotedArray?: (values: Quotable[]) => unknown[] };
      quotedArray?: (values: Quotable[]) => unknown[];
    };

type HomogeneousInType = 'in' | 'notIn';

export class HomogeneousInNode extends Node {
  public readonly attribute: HomogeneousAttribute;
  public readonly values: Quotable[];
  public readonly type: HomogeneousInType;

  constructor(values: Quotable[], attribute: HomogeneousAttribute, type: HomogeneousInType) {
    super();
    this.attribute = attribute;
    this.values = values;
    this.type = type;
  }
  left = () => this.attribute;
  right = () => {
    const attr = this.attribute as {
      quotedArray?: (values: Quotable[]) => unknown[];
      relation?: { quotedArray?: (values: Quotable[]) => unknown[] };
    };
    if (typeof attr.quotedArray === 'function') {
      return attr.quotedArray(this.values);
    }
    if (attr.relation && typeof attr.relation.quotedArray === 'function') {
      return attr.relation.quotedArray(this.values);
    }
    return this.values;
  };

  castedValues = (): BindValue[] => {
    const attr = this.attribute as { typeCaster?: () => { serialize?: (v: Quotable) => Quotable } };
    const type = typeof attr.typeCaster === 'function' ? attr.typeCaster() : null;

    if (type && typeof type.serialize === 'function') {
      return this.values.map((rawValue) => type.serialize?.(rawValue));
    }
    return this.values;
  };

  procForBinds = (): ((value: unknown) => unknown) => (value) => value;

  override fetchAttribute = (callback: FetchAttributeCallback) => {
    // Only the `Attribute` variant of `HomogeneousAttribute` is a real Expression;
    // a custom structural attribute (e.g. tests' `TypedNode`) has no fetchable Attribute.
    if (this.attribute instanceof Attribute) return callback(this.attribute);
    return undefined;
  };

  override equality = () => this.type === 'in';
  override invert = () => new HomogeneousInNode(this.values, this.attribute, this.type === 'in' ? 'notIn' : 'in');

  ivars = () => [this.attribute, this.values, this.type];
  override hash = () => hash(this.ivars());
}
