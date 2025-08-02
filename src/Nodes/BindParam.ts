import { hash } from '../utilities/hash';
import { isInfinity, isUnboundable } from '../utilities/nodes';
import { Node } from './Node';

type ValueType = any;

export class BindParamNode extends Node {
  public readonly value: ValueType;

  constructor(value: ValueType) {
    super();
    this.value = value;
  }

  override hash = () => hash([this.constructor.name, this.value]);
  override isNull = () => this.value == null;
  valueBeforeTypeCast = () => {
    if ('valueBeforeTypeCast' in this.value) {
      return this.value.valueBeforeTypeCast();
    }
    return this.value;
  };
  isInfinity = () => isInfinity(this.value);
  isUnboundable = () => isUnboundable(this.value);
}
