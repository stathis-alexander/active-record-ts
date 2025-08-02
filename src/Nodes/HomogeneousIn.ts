import type { Attribute } from '../types';
import { hash } from '../utilities/hash';
import { type FetchAttributeCallbackType, Node } from './Node';

type AttributeType = any;
type ValuesType = any[];

type HomogeneousInType = 'in' | 'notIn';

export class HomogeneousInNode extends Node {
  public readonly attribute: Attribute;
  public readonly values: ValuesType;
  public readonly type: HomogeneousInType;

  constructor(values: ValuesType, attribute: AttributeType, type: HomogeneousInType) {
    super();
    this.attribute = attribute;
    this.values = values;
    this.type = type;
  }
  left = () => this.attribute;
  right = () => this.attribute.quotedArray(this.values);

  castedValues = () => {
    const type = this.attribute.typeCaster();

    const castedValues = this.values
      .map((rawValue) => (type.serializeable ? type.serialize(rawValue) : undefined))
      .filter(Boolean);

    return castedValues;
  };

  // should return ActiveModel::Attribute.with_cast_value(attribute.name, value, ActiveModel::Type.default_value)
  procForBinds = () => (value: any) => undefined;
  override fetchAttribute = (callback: FetchAttributeCallbackType) => {
    if (this.attribute) return callback(this.attribute);

    // this feels like a bug... but it's a bug in Arel proper as well.
    return this.expression.fetchAttribute(callback);
  };

  override equality = () => this.type === 'in';
  override invert = () => new HomogeneousInNode(this.values, this.attribute, this.type === 'in' ? 'notIn' : 'in');

  ivars = () => [this.attribute, this.values, this.type];
  override hash = () => hash(this.ivars());
}
